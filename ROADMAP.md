# HRIS Roadmap

## Phase 1 - Foundation HRIS

- [x] Employee master baseline
- [x] Department and role structure
- [x] Contract data
- [x] Payroll baseline data structure
- [x] Auth and role-based access

## Phase 2 - Attendance Core

- [x] Check-in / check-out
- [x] GPS validation
- [x] Camera / selfie upload
- [x] Shift and schedule management
- [x] Overtime management

## Phase 3 - Leave and Approval

- [x] Annual leave
- [x] Sick leave
- [x] Permission flow
- [x] Automatic approval rules
- [x] Leave balance tracking

## Phase 4 - Payroll

- [x] Salary component engine
- [x] Automatic payroll calculation
- [x] Tax deduction (PPh)
- [x] Payslip generation

## Phase 5 - Employee Self Service and Reporting

- [x] Employee self-service portal
- [x] Payslip download
- [x] Payroll reports
- [x] Employee reports
- [x] Attendance reports

## Roadmap Update

Modul hr-app karyawan:

1. Modul kehadiran
   - On duty request
   - Sick submission
   - Leave request
     cuti ada annual, keagamaan, lahiran, kedukaan. tambahin balance setiap cuti di leave request (DONE)
   - Half day leave
   - Attendance summary
   - Submit overtime (karyawan submit overtime, atasan acc overtime)
   - Semua Records (Summary) disamain kaya attendance records semua
   - Tombol clock in kalo udah disubmit jadi clock out (DONE)
   - Foto selfie harusnya otomatis ke capture waktu dia submit check-in, terus pilihan employee nya ga usah ada, otomatis sesuai akun yang login aja. (DONE)

2. Modul payroll
   - Generate slip gaji
   - History slip gaji
   - Slip gaji jadiin pdf terus dirapihin yang proper (NEW)

3. Modul Profil
   - Data karyawan

4. Modul Reimbursement (Future Feature)
   1. medical
      - 10 jt rawat jalan out patient & flexi (claim yang bisa digunakan untuk keperluan pekerjaan)
      - lahiran (normal & cesar)
   2. other reimbursement
   3. upload dokumen receipt/struk

5. Dashboard
   - Grafik attendance

6. modul dinas luar buat tracking berapa lamanya, budget perjalanan dinas nya (NEW)

Modul hr-app HR:

1. Modul Kehadiran
   - Report kehadiran karyawan
   - Biar bisa liat selfie karyawan clock in (DONE)

2. Modul Employee List
   - Masukin data karyawan termasuk gaji, tunjangan, deduction (bpjs, pajak), akun portal hr (Done)
   - upload dokumen karyawan kaya ktp, ijazah, sertifikat (Done)

3. Modul Payroll (Belakangan)
   - Data gaji karyawan, termasuk kalkulasi kehadiran. Nanti di akhir bulan biar keliatan gaji karyawan tersebut berapa
   - pertimbangin payroll pro-rate buat karyawan yang baru masuk, perhitungan THR & Bonus (perkalian atau amount) gimana
   - payroll otomatis kirim email
   - di add employee financial detail perlu ada total gaji, base salary + allowances - deduction. perhitungan pajak nya dikalkulasiin sama gaji gross. minta perhitungan pajaknya otomatis, dan diambil perhitungan pajaknya dari sumber pajak resmi di indonesia
   - sebelum submit ke bank bikin approval 2 step, dari hrd ke dan manager hrd
   - kita mau bikin sistem yang pake payroll dan ga pake payroll. sistem yang ga pake payroll semua financial things disembunyiin, yang pake payroll tampilin semua financial things

4. Modul report (NY Done)
   - Generate report attendance, employee list, payroll
   - Grafik attendance, grafik jumlah karyawan
5. Dashboard (Done)
   - Grafik attendance, grafik jumlah karyawan, grafik payroll (jumlah gaji yang dibayarkan tiap bulan)

6. Modul buat ngatur cuti karyawan (Done)

Beresin login page

bikin responsive buat di browser mobile

suka nongolin file2 aneh di folder projek, trace itu kenapa
