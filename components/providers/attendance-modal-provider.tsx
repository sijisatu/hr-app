"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, CameraOff, LoaderCircle, MapPinned, RefreshCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  createCheckIn,
  createCheckOut,
  getAttendanceToday,
  getEmployees,
  type AttendanceRecord
} from "@/lib/api";
import { useSession } from "@/components/providers/session-provider";

type AttendanceModalContextValue = {
  openModal: () => void;
  closeModal: () => void;
  isOpen: boolean;
};

const AttendanceModalContext = createContext<AttendanceModalContextValue | null>(null);

function detectLocationName(latitude: number, longitude: number) {
  const anchors = [
    { name: "Jakarta HQ", latitude: -6.2, longitude: 106.816666 },
    { name: "Bandung Hub", latitude: -6.917464, longitude: 107.619123 },
    { name: "Surabaya Office", latitude: -7.257472, longitude: 112.752088 },
    { name: "Remote - Yogyakarta", latitude: -7.797068, longitude: 110.370529 }
  ];

  let best = anchors[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const anchor of anchors) {
    const distance = Math.hypot(anchor.latitude - latitude, anchor.longitude - longitude);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = anchor;
    }
  }
  return best.name;
}

function findOpenRecord(records: AttendanceRecord[], employeeId: string) {
  return records.find((record) => record.userId === employeeId && record.checkOut === null) ?? null;
}

function AttendanceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { currentUser } = useSession();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [mounted, setMounted] = useState(false);
  const [locationName, setLocationName] = useState("Jakarta HQ");
  const [latitude, setLatitude] = useState("-6.200000");
  const [longitude, setLongitude] = useState("106.816666");
  const [photo, setPhoto] = useState<File | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [geoStatus, setGeoStatus] = useState("Use current location or keep the worksite default.");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraReady(false);
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 960 } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
    } catch {
      setCameraError("Camera belum bisa diakses. Pastikan izin browser aktif.");
      setCameraReady(false);
    }
  }, [stopCamera]);

  useEffect(() => {
    if (!open || !mounted) {
      stopCamera();
      return;
    }
    if (typeof navigator.mediaDevices?.getUserMedia === "function") {
      void startCamera();
    } else {
      setCameraError("Browser ini belum support live camera capture.");
    }
    return () => stopCamera();
  }, [mounted, open, startCamera, stopCamera]);

  const employeesQuery = useQuery({ queryKey: ["employees"], queryFn: getEmployees, enabled: open });
  const todayQuery = useQuery({ queryKey: ["attendance-today"], queryFn: getAttendanceToday, enabled: open });

  const employees = employeesQuery.data ?? [];
  const todayRecords = todayQuery.data ?? [];
  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === currentUser?.id) ?? null,
    [currentUser?.id, employees]
  );

  useEffect(() => {
    if (!selectedEmployee) {
      return;
    }
    setLocationName(selectedEmployee.workLocation);
  }, [selectedEmployee]);

  const openRecord = selectedEmployee ? findOpenRecord(todayRecords, selectedEmployee.id) : null;

  const closeAndRefresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["attendance-today"] }),
      queryClient.invalidateQueries({ queryKey: ["employees"] })
    ]);
    router.refresh();
    onClose();
  }, [onClose, queryClient, router]);

  const checkInMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEmployee) {
        throw new Error("Akun login belum terhubung ke data karyawan aktif.");
      }
      const captured = await capturePhoto();
      const selfieFile = captured ?? photo;
      if (!selfieFile) {
        throw new Error("Camera belum siap untuk auto selfie capture.");
      }
      const numericLat = Number.parseFloat(latitude);
      const numericLng = Number.parseFloat(longitude);
      if (Number.isNaN(numericLat) || Number.isNaN(numericLng)) {
        throw new Error("Koordinat belum valid.");
      }
      return createCheckIn({
        userId: selectedEmployee.id,
        employeeName: selectedEmployee.name,
        department: selectedEmployee.department,
        location: locationName,
        latitude: numericLat,
        longitude: numericLng,
        photo: selfieFile
      });
    },
    onSuccess: async () => {
      setErrorMessage(null);
      setPhoto(null);
      await closeAndRefresh();
    },
    onError: (error: Error) => setErrorMessage(error.message)
  });

  const checkOutMutation = useMutation({
    mutationFn: async () => {
      if (!openRecord) {
        throw new Error("Belum ada sesi absensi yang terbuka untuk karyawan ini.");
      }
      return createCheckOut({ attendanceId: openRecord.id });
    },
    onSuccess: async () => {
      setErrorMessage(null);
      await closeAndRefresh();
    },
    onError: (error: Error) => setErrorMessage(error.message)
  });

  const capturePhoto = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) {
      return null;
    }
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 720;
    canvas.height = video.videoHeight || 960;
    const context = canvas.getContext("2d");
    if (!context) {
      setCameraError("Canvas belum siap untuk capture.");
      return null;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) {
      setCameraError("Gagal ambil foto dari live camera.");
      return null;
    }
    const file = new File([blob], `selfie-${Date.now()}.jpg`, { type: "image/jpeg" });
    setPhoto(file);
    return file;
  }, []);

  const handleUseCurrentLocation = async () => {
    if (!("geolocation" in navigator)) {
      setGeoStatus("Browser ini belum dukung geolocation.");
      return;
    }
    setGeoStatus("Mengambil posisi device...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLat = position.coords.latitude.toFixed(6);
        const nextLng = position.coords.longitude.toFixed(6);
        setLatitude(nextLat);
        setLongitude(nextLng);
        setLocationName(detectLocationName(position.coords.latitude, position.coords.longitude));
        setGeoStatus("Lokasi device berhasil dipakai untuk absensi.");
      },
      () => setGeoStatus("Izin lokasi ditolak. Pakai titik worksite default dulu."),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const busy = checkInMutation.isPending || checkOutMutation.isPending;

  if (!mounted || !open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-950/55 p-4 sm:p-6">
      <div className="w-full max-w-3xl overflow-hidden rounded-[32px] bg-white shadow-2xl ring-1 ring-slate-200">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-7">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted">Attendance Capture</p>
            <h2 className="mt-2 section-title text-3xl font-semibold text-[var(--primary)]">Check-in / Check-out</h2>
            <p className="mt-2 max-w-xl text-sm text-muted">Kamera depan langsung aktif saat popup dibuka, jadi selfie diambil live tanpa upload file manual.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-2xl bg-[var(--panel-alt)] p-3 text-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[82vh] overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
          <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-5">
              <div className="rounded-[28px] bg-[var(--primary)] p-5 text-white">
                <p className="text-xs uppercase tracking-[0.22em] text-white/60">Current employee</p>
                <p className="mt-2 text-2xl font-semibold">{selectedEmployee?.name ?? "Loading..."}</p>
                <p className="mt-2 text-sm text-white/75">{selectedEmployee ? `${selectedEmployee.department} | ${selectedEmployee.position}` : "Fetching employee roster"}</p>
                <div className="mt-4 rounded-[22px] bg-white/10 p-4 text-sm text-white/85">
                  <p className="font-semibold text-white">Session status</p>
                  <p className="mt-2">{openRecord ? `Open since ${openRecord.checkIn} at ${openRecord.location}` : "No open attendance session for your account today."}</p>
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-[var(--panel-alt)] px-4 py-3 text-sm text-muted">
                Employee dipilih otomatis berdasarkan akun yang sedang login.
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <label className="space-y-2 text-sm font-medium text-[var(--primary)] sm:col-span-3">
                  Worksite
                  <input value={locationName} onChange={(event) => setLocationName(event.target.value)} className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-slate-700" />
                </label>
                <label className="space-y-2 text-sm font-medium text-[var(--primary)]">
                  Latitude
                  <input value={latitude} onChange={(event) => setLatitude(event.target.value)} className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-slate-700" />
                </label>
                <label className="space-y-2 text-sm font-medium text-[var(--primary)]">
                  Longitude
                  <input value={longitude} onChange={(event) => setLongitude(event.target.value)} className="w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm text-slate-700" />
                </label>
                <div className="rounded-2xl border border-dashed border-border bg-[var(--panel-alt)] px-4 py-3 text-sm text-muted">GPS akan divalidasi otomatis pas submit.</div>
              </div>

              <div className="rounded-[24px] border border-border bg-[var(--panel-alt)] p-4">
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" onClick={handleUseCurrentLocation} className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[var(--primary)]">
                    <MapPinned className="h-4 w-4" />
                    Use current location
                  </button>
                  <button type="button" onClick={() => void startCamera()} className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-[var(--primary)]">
                    <RefreshCcw className="h-4 w-4" />
                    Restart camera
                  </button>
                </div>
                <p className="mt-3 text-sm text-muted">{geoStatus}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="overflow-hidden rounded-[28px] border border-border bg-slate-950 shadow-soft">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 text-white">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    {cameraReady ? <Camera className="h-4 w-4" /> : <CameraOff className="h-4 w-4" />}
                    Live Selfie Camera
                  </div>
                  {photo ? <span className="text-xs uppercase tracking-[0.18em] text-emerald-300">Captured</span> : null}
                </div>
                <div className="relative aspect-[3/4] bg-slate-900">
                  <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
                  {!cameraReady ? <div className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-white/70">{cameraError ?? "Menyalakan camera..."}</div> : null}
                </div>
              </div>

              <canvas ref={canvasRef} className="hidden" />

              <div className="rounded-[24px] border border-border bg-[var(--panel-alt)] p-4">
                <p className="text-sm font-semibold text-[var(--primary)]">Selfie status</p>
                <p className="mt-2 text-sm text-muted">{photo ? `${photo.name} siap dikirim ke attendance storage.` : "Selfie akan auto-capture saat Submit Check-in."}</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <button type="button" onClick={() => void capturePhoto()} disabled={!cameraReady || busy} className="rounded-2xl bg-[var(--primary)] px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
                    Capture manual
                  </button>
                  <button type="button" onClick={() => setPhoto(null)} disabled={!photo || busy} className="rounded-2xl border border-[var(--primary)]/15 bg-white px-4 py-3 text-sm font-semibold text-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-60">
                    Retake
                  </button>
                </div>
              </div>

              {cameraError ? <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{cameraError}</div> : null}
              {errorMessage ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div> : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={() => checkInMutation.mutate()} disabled={busy || !selectedEmployee || Boolean(openRecord) || employeesQuery.isLoading || todayQuery.isLoading} className="rounded-2xl bg-[var(--primary)] px-4 py-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
                  {checkInMutation.isPending ? <span className="flex items-center justify-center gap-2"><LoaderCircle className="h-4 w-4 animate-spin" /> Saving check-in + auto selfie...</span> : "Submit Check-in"}
                </button>
                <button type="button" onClick={() => checkOutMutation.mutate()} disabled={busy || !openRecord || employeesQuery.isLoading || todayQuery.isLoading} className="rounded-2xl border border-[var(--primary)]/15 bg-[var(--panel-alt)] px-4 py-4 text-sm font-semibold text-[var(--primary)] disabled:cursor-not-allowed disabled:opacity-60">
                  {checkOutMutation.isPending ? <span className="flex items-center justify-center gap-2"><LoaderCircle className="h-4 w-4 animate-spin" /> Closing session...</span> : "Submit Check-out"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export function AttendanceModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const openModal = useCallback(() => setIsOpen(true), []);
  const closeModal = useCallback(() => setIsOpen(false), []);

  return (
    <AttendanceModalContext.Provider value={{ openModal, closeModal, isOpen }}>
      {children}
      <AttendanceModal open={isOpen} onClose={closeModal} />
    </AttendanceModalContext.Provider>
  );
}

export function useAttendanceModal() {
  const context = useContext(AttendanceModalContext);
  if (!context) {
    throw new Error("useAttendanceModal must be used within AttendanceModalProvider");
  }
  return context;
}



