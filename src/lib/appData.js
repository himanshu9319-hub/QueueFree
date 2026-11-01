import { Activity, HeartPulse, MapPin, Ticket, BriefcaseMedical } from 'lucide-react'

export const hospitalSamples = [
  { id: 10, name: 'DEMO General Hospital', slug: 'demo-general-hospital', city: 'Dehradun', area: 'Rajpur Road', distance: '1.2 km', rating: '4.8', wait: '10 min', specialty: 'Multi-Specialty OPD (Demo Facility)', is_demo: true, integration_mode: 'native', official_booking_url: '', lat: 30.3165, lng: 78.0322 },
  { id: 15, name: 'Himalayan Hospital, Jolly Grant', slug: 'himalayan-hospital-jollygrant-dehradun', city: 'Dehradun, Uttarakhand', area: 'Jolly Grant, Swami Ram Nagar', distance: '14.2 km', rating: '4.8', wait: 'Direct Portal', specialty: 'Apex Tertiary Care & Teaching Hospital', is_demo: false, integration_mode: 'redirect', official_booking_url: 'https://appointment.himalayanhospital.org:214/', redirect_url: 'https://appointment.himalayanhospital.org:214/', lat: 30.1989, lng: 78.1802 },
  { id: 13, name: 'B. P. Poddar Hospital & Medical Research Limited', slug: 'bp-poddar-hospital-and-medical-research-limited-kolkata', city: 'Kolkata, West Bengal', area: 'New Alipore', distance: '3.4 km', rating: '4.9', wait: '15 min', specialty: 'Multi-Speciality (API Integrated)', is_demo: false, integration_mode: 'api', official_booking_url: 'https://ios.bppoddarhospital.com/index.html', lat: 22.5085, lng: 88.3312 },
  { id: 11, name: 'AIIMS Rishikesh', slug: 'aiims-rishikesh', city: 'Rishikesh, Uttarakhand', area: 'Virbhadra Road', distance: '4.5 km', rating: '4.9', wait: '35 min', specialty: 'Apex Tertiary Care & Teaching', is_demo: false, integration_mode: 'api', official_booking_url: 'https://aiimsrishikesh.edu.in/opd', lat: 30.0765, lng: 78.2882 },
  { id: 12, name: 'Max Super Speciality Hospital', slug: 'max-hospital-dehradun', city: 'Dehradun, Uttarakhand', area: 'Mussoorie Diversion Road', distance: '6.8 km', rating: '4.7', wait: '20 min', specialty: 'Super Speciality Hospital', is_demo: false, integration_mode: 'redirect', official_booking_url: 'https://www.maxhealthcare.in/book-an-appointment', lat: 30.3642, lng: 78.0772 },
  { id: 4, name: 'Fortis Hospital', slug: 'fortis-hospital-anandapur-kolkata', city: 'Dehradun, Uttarakhand', area: 'Cunningham Road', distance: '5.2 km', rating: '4.6', wait: '18 min', specialty: 'Multi-Specialty Care', is_demo: false, integration_mode: 'redirect', official_booking_url: 'https://www.fortishealthcare.com/india/hospitals-in-uttarakhand/fortis-hospital-dehradun', lat: 30.3165, lng: 78.0322 },
  { id: 5, name: 'Apollo Clinic', slug: 'apollo-clinic-haridwar', city: 'Haridwar, Uttarakhand', area: 'Ranipur More', distance: '8.1 km', rating: '4.7', wait: '15 min', specialty: 'Daycare & Diagnostic Center', is_demo: false, integration_mode: 'redirect', official_booking_url: 'https://www.apolloclinic.com/for-patients/book-an-appointment', lat: 29.9457, lng: 78.1642 },
  { id: 6, name: 'Manipal Hospital', slug: 'manipal-hospital-hal-airport-road-bengaluru', city: 'Bengaluru, Karnataka', area: 'Old Airport Road', distance: '5.1 km', rating: '4.8', wait: '25 min', specialty: 'Quaternary Healthcare Facility', is_demo: false, integration_mode: 'redirect', official_booking_url: 'https://www.manipalhospitals.com/oldairportroad/', lat: 12.9592, lng: 77.6484 },
  { id: 7, name: 'Apollo Hospitals', slug: 'apollo-hospitals-bannerghatta-bengaluru', city: 'Bengaluru, Karnataka', area: 'Bannerghatta Road', distance: '2.4 km', rating: '4.8', wait: '18 min', specialty: 'Comprehensive Specialty Hospital', is_demo: false, integration_mode: 'redirect', official_booking_url: 'https://www.apollohospitals.com/locations/india/bangalore/bannerghatta-road', lat: 12.8958, lng: 77.5996 },
  { id: 8, name: 'AIIMS Delhi', slug: 'aiims-new-delhi', city: 'Delhi, NCR', area: 'Ansari Nagar', distance: '3.2 km', rating: '4.9', wait: '45 min', specialty: 'National Medical Institute', is_demo: false, integration_mode: 'redirect', official_booking_url: 'https://ors.gov.in', lat: 28.5672, lng: 77.21 },
  { id: 9, name: 'Tata Memorial Hospital', slug: 'tata-memorial-hospital-mumbai', city: 'Mumbai, Maharashtra', area: 'Parel', distance: '6.1 km', rating: '4.9', wait: '40 min', specialty: 'Apex Cancer Care & Research', is_demo: false, integration_mode: 'redirect', official_booking_url: 'https://tmc.gov.in/index.php/en/patient-portal', lat: 19.003, lng: 72.843 },
  { id: 14, name: 'Alipore Community Health Center', slug: 'alipore-community-health-center-kolkata', city: 'Kolkata, West Bengal', area: 'Alipore District', distance: '4.2 km', rating: '4.1', wait: '—', specialty: 'Community Health Center', is_demo: false, integration_mode: 'native', integration_status: 'NOT_CONFIGURED', official_booking_url: '', lat: 22.528, lng: 88.335 },
]

export const initialHospitals = hospitalSamples.map(hospital => ({
  ...hospital,
  address: null,
  state: null,
  pincode: null,
  latitude: hospital.lat,
  longitude: hospital.lng,
  googlePlaceId: null,
  phone: null,
  openingHours: null,
  emergency24x7: null,
}))

// Complete list of all 25 OPD medical specialty departments in modern healthcare
export const departments = [
  'General Medicine',
  'Cardiology',
  'Dermatology & Skin Care',
  'Orthopedics & Joint Replacement',
  'Pediatrics & Child Health',
  'Obstetrics & Gynecology',
  'ENT (Ear, Nose & Throat)',
  'Ophthalmology (Eye Care)',
  'Neurology & Stroke Care',
  'Neurosurgery & Spine Surgery',
  'Gastroenterology & Liver Clinic',
  'Pulmonology & Respiratory Medicine',
  'Endocrinology & Diabetology',
  'Nephrology & Renal Care',
  'Urology & Andrology',
  'General & Laparoscopic Surgery',
  'Oncology & Cancer Care',
  'Psychiatry & Behavioral Health',
  'Rheumatology & Clinical Immunology',
  'Dental & Maxillofacial Surgery',
  'Plastic & Cosmetic Surgery',
  'Physical Medicine & Rehabilitation',
  'Hematology & Bone Marrow',
  'Geriatric Medicine (Elder Care)',
  'Dietetics & Clinical Nutrition',
]

export const poddarDepartments = [
  { id: 1, name: 'Cardiology & Interventional Care', code: 'cardio', room: 'OPD Block A - Room 102', floor: 'Ground Floor', description: 'Comprehensive adult and pediatric heart care with state-of-the-art Cath Lab & CCU' },
  { id: 2, name: 'Neurology & Neurosurgery', code: 'neuro', room: 'Neuro Suite - Room 201', floor: '2nd Floor', description: 'Advanced brain, spine and neurological stroke intervention center' },
  { id: 3, name: 'Orthopedics & Joint Replacement', code: 'ortho', room: 'Ortho Wing - Room 115', floor: '1st Floor', description: 'Complex trauma, arthroscopy, joint reconstruction, and spine surgery' },
  { id: 4, name: 'General & Internal Medicine', code: 'gen-med', room: 'General OPD - Room 101', floor: 'Ground Floor', description: 'Adult preventive care, metabolic management, and critical inpatient care' },
  { id: 5, name: 'Gastroenterology & Hepatology', code: 'gastro', room: 'Endoscopy Suite - Room 305', floor: '3rd Floor', description: 'Digestive health, therapeutic endoscopy, and liver disease treatment' },
  { id: 6, name: 'Nephrology & Renal Sciences', code: 'nephro', room: 'Renal Sciences - Room 208', floor: '2nd Floor', description: 'Kidney disease management, peritoneal and hemodialysis support' },
]

export const poddarDoctors = [
  { id: 101, departmentId: 1, departmentName: 'Cardiology & Interventional Care', display_name: 'Dr. Subhashish Poddar', qualification: 'MBBS, MD (Med), DM (Cardiology)', designation: 'Senior Interventional Cardiologist', experienceYears: 22, rating: 4.9, reviews: 2450, average_consultation_minutes: 15, room: 'OPD Block A - Room 102', opdTiming: '09:30 AM - 01:00 PM', fee: 900 },
  { id: 102, departmentId: 1, departmentName: 'Cardiology & Interventional Care', display_name: 'Dr. Ritwik Ghosh', qualification: 'MBBS, DNB (Cardiology), FACC', designation: 'Consultant Cardiologist', experienceYears: 14, rating: 4.8, reviews: 1320, average_consultation_minutes: 15, room: 'OPD Block A - Room 104', opdTiming: '10:00 AM - 02:00 PM', fee: 800 },
  { id: 201, departmentId: 2, departmentName: 'Neurology & Neurosurgery', display_name: 'Dr. Debashis Sen', qualification: 'MBBS, MS, MCh (Neuro)', designation: 'Chief Neurosurgeon', experienceYears: 19, rating: 4.9, reviews: 1890, average_consultation_minutes: 15, room: 'Neuro Suite - Room 201', opdTiming: '10:00 AM - 02:30 PM', fee: 1000 },
  { id: 301, departmentId: 3, departmentName: 'Orthopedics & Joint Replacement', display_name: 'Dr. Amitava Mukherjee', qualification: 'MBBS, MS (Ortho), FRCS', designation: 'Senior Joint Replacement Specialist', experienceYears: 17, rating: 4.8, reviews: 1640, average_consultation_minutes: 15, room: 'Ortho Wing - Room 115', opdTiming: '09:30 AM - 01:30 PM', fee: 850 },
  { id: 401, departmentId: 4, departmentName: 'General & Internal Medicine', display_name: 'Dr. Sharmistha Bhattacharya', qualification: 'MBBS, MD (Medicine)', designation: 'Consultant Physician', experienceYears: 15, rating: 4.8, reviews: 2110, average_consultation_minutes: 15, room: 'General OPD - Room 101', opdTiming: '09:00 AM - 01:00 PM', fee: 700 },
  { id: 501, departmentId: 5, departmentName: 'Gastroenterology & Hepatology', display_name: 'Dr. Souvik Banerjee', qualification: 'MBBS, MD, DNB (Gastro)', designation: 'Consultant Gastroenterologist', experienceYears: 12, rating: 4.7, reviews: 980, average_consultation_minutes: 15, room: 'Endoscopy Suite - Room 305', opdTiming: '10:30 AM - 02:00 PM', fee: 850 },
  { id: 601, departmentId: 6, departmentName: 'Nephrology & Renal Sciences', display_name: 'Dr. Anirban Majumder', qualification: 'MBBS, MD, DM (Nephrology)', designation: 'Senior Consultant Nephrologist', experienceYears: 16, rating: 4.9, reviews: 1470, average_consultation_minutes: 15, room: 'Renal Sciences - Room 208', opdTiming: '11:00 AM - 03:00 PM', fee: 900 },
]

export const richDepartments = [
  { id: 101, name: 'General Medicine', code: 'gen-med', room: 'OPD Room 102, 1st Floor', floor: '1st Floor', description: 'Internal medicine, fever, infectious diseases, hypertension, diabetes & acute illnesses' },
  { id: 102, name: 'Cardiology', code: 'cardio', room: 'Heart Center, Room 204', floor: '2nd Floor', description: 'Cardiovascular health, ECG, echocardiography, preventive cardiology, angioplasty & pacemaker clinic' },
  { id: 103, name: 'Dermatology & Skin Care', code: 'derma', room: 'OPD Block B, Room 121', floor: 'Ground Floor', description: 'Skin disorders, clinical dermatology, hair loss, acne, eczema, psoriasis & laser cosmetology' },
  { id: 104, name: 'Orthopedics & Joint Replacement', code: 'ortho', room: 'Surgical Block, Room 110', floor: '1st Floor', description: 'Bone fractures, joint replacements (knee/hip), spine disorders, sports medicine & arthroscopy' },
  { id: 105, name: 'Pediatrics & Child Health', code: 'pedia', room: 'Mother & Child Block, Room 116', floor: '1st Floor', description: 'Newborn care, growth monitoring, adolescent health, vaccinations & pediatric acute infections' },
  { id: 106, name: 'Obstetrics & Gynecology', code: 'gynae', room: "Women's Health Pavilion, Room 212", floor: '2nd Floor', description: 'Antenatal care, high-risk pregnancy, PCOS/PCOD, laparoscopy, infertility & women wellness' },
  { id: 107, name: 'ENT (Ear, Nose & Throat)', code: 'ent', room: 'OPD Block B, Room 125', floor: 'Ground Floor', description: 'Hearing tests, vertigo clinic, endoscopic sinus surgery, tonsils, adenoids & vocal cord care' },
  { id: 108, name: 'Ophthalmology (Eye Care)', code: 'eye', room: 'Vision Pavilion, Room 131', floor: 'Ground Floor', description: 'Comprehensive eye checkups, cataract microsurgery, glaucoma management, LASIK & retina care' },
  { id: 109, name: 'Neurology & Stroke Care', code: 'neuro', room: 'Neuroscience Wing, Room 302', floor: '3rd Floor', description: 'Migraines, epilepsy, acute stroke prevention, Parkinson’s disease, neuropathy & tremors' },
  { id: 110, name: 'Neurosurgery & Spine Surgery', code: 'neuro-surg', room: 'Neuroscience Wing, Room 308', floor: '3rd Floor', description: 'Brain tumor surgery, spinal disc herniation, minimally invasive spine surgery & cranial trauma' },
  { id: 111, name: 'Gastroenterology & Liver Clinic', code: 'gastro', room: 'Digestive Sciences, Room 218', floor: '2nd Floor', description: 'Stomach ulcers, IBS, acid reflux, chronic liver care, hepatitis, colonoscopy & endoscopy' },
  { id: 112, name: 'Pulmonology & Respiratory Medicine', code: 'pulmo', room: 'Respiratory Care, Room 140', floor: '1st Floor', description: 'Bronchial asthma, COPD, chronic cough, pneumonia, sleep apnea & pulmonary fibrosis' },
  { id: 113, name: 'Endocrinology & Diabetology', code: 'endo', room: 'Metabolic Wing, Room 108', floor: 'Ground Floor', description: 'Type 1 & 2 diabetes management, thyroid nodules, obesity clinic, metabolic & adrenal health' },
  { id: 114, name: 'Nephrology & Renal Care', code: 'nephro', room: 'Renal Care Block, Room 225', floor: '2nd Floor', description: 'Chronic kidney disease, dialysis evaluation, glomerulonephritis, proteinuria & renal hypertension' },
  { id: 115, name: 'Urology & Andrology', code: 'uro', room: 'Surgical Block, Room 118', floor: '1st Floor', description: 'Kidney stones, laser prostate surgery, male reproductive health & urinary tract disorders' },
  { id: 116, name: 'General & Laparoscopic Surgery', code: 'gen-surg', room: 'Surgical Block, Room 115', floor: '1st Floor', description: 'Minimally invasive laparoscopic gallbladder, hernia repair, appendix, lipomas & soft tissue surgery' },
  { id: 117, name: 'Oncology & Cancer Care', code: 'onco', room: 'Cancer Center, Room 402', floor: '4th Floor', description: 'Cancer screening, medical chemotherapy, targeted immunotherapy, surgical oncology consultation & care' },
  { id: 118, name: 'Psychiatry & Behavioral Health', code: 'psych', room: 'Mind & Wellness Wing, Room 315', floor: '3rd Floor', description: 'Depression, anxiety, panic disorders, sleep disturbances, adult ADHD & psychological counseling' },
  { id: 119, name: 'Rheumatology & Clinical Immunology', code: 'rheuma', room: 'OPD Block A, Room 105', floor: 'Ground Floor', description: 'Rheumatoid arthritis, ankylosing spondylitis, lupus (SLE), gout & autoimmune connective diseases' },
  { id: 120, name: 'Dental & Maxillofacial Surgery', code: 'dental', room: 'Dental Clinic, Room 136', floor: 'Ground Floor', description: 'Root canal therapy, dental implants, teeth alignment, wisdom tooth extraction & jaw surgery' },
  { id: 121, name: 'Plastic & Cosmetic Surgery', code: 'plastic', room: 'Surgical Block, Room 120', floor: '1st Floor', description: 'Reconstructive micro-surgery, scar revision, burn care, facial rejuvenation & hand trauma surgery' },
  { id: 122, name: 'Physical Medicine & Rehabilitation', code: 'pmr', room: 'Rehab Pavilion, Room 101', floor: 'Ground Floor', description: 'Neuro-rehabilitation, stroke recovery, physiotherapy, spine pain management & ergonomic therapy' },
  { id: 123, name: 'Hematology & Bone Marrow', code: 'hemato', room: 'Hematology Wing, Room 406', floor: '4th Floor', description: 'Severe anemias, platelet disorders, hemophilia, thalassemia, blood clotting & leukemia evaluation' },
  { id: 124, name: 'Geriatric Medicine (Elder Care)', code: 'geriatric', room: 'Wellness Pavilion, Room 107', floor: 'Ground Floor', description: 'Specialized healthcare for senior citizens: memory care, multi-morbidity management & mobility' },
  { id: 125, name: 'Dietetics & Clinical Nutrition', code: 'diet', room: 'Nutritional Care, Room 109', floor: 'Ground Floor', description: 'Medical nutritional therapy for diabetes, renal disease, cardiac wellness, bariatric & lifestyle health' },
]

export const richDoctors = [
  // 0. B. P. Poddar Hospital & Medical Research Limited Official Specialists
  { id: 101, departmentId: 1, departmentName: 'Cardiology & Interventional Care', display_name: 'Dr. Subhashish Poddar', qualification: 'MBBS, MD (Med), DM (Cardiology)', designation: 'Senior Interventional Cardiologist', experienceYears: 22, rating: 4.9, reviews: 2450, average_consultation_minutes: 15, room: 'OPD Block A - Room 102', opdTiming: '09:30 AM - 01:00 PM', fee: 900 },
  { id: 102, departmentId: 1, departmentName: 'Cardiology & Interventional Care', display_name: 'Dr. Ritwik Ghosh', qualification: 'MBBS, DNB (Cardiology), FACC', designation: 'Consultant Cardiologist', experienceYears: 14, rating: 4.8, reviews: 1320, average_consultation_minutes: 15, room: 'OPD Block A - Room 104', opdTiming: '10:00 AM - 02:00 PM', fee: 800 },
  { id: 201, departmentId: 2, departmentName: 'Neurology & Neurosurgery', display_name: 'Dr. Debashis Sen', qualification: 'MBBS, MS, MCh (Neuro)', designation: 'Chief Neurosurgeon', experienceYears: 19, rating: 4.9, reviews: 1890, average_consultation_minutes: 15, room: 'Neuro Suite - Room 201', opdTiming: '10:00 AM - 02:30 PM', fee: 1000 },
  { id: 301, departmentId: 3, departmentName: 'Orthopedics & Joint Replacement', display_name: 'Dr. Amitava Mukherjee', qualification: 'MBBS, MS (Ortho), FRCS', designation: 'Senior Joint Replacement Specialist', experienceYears: 17, rating: 4.8, reviews: 1640, average_consultation_minutes: 15, room: 'Ortho Wing - Room 115', opdTiming: '09:30 AM - 01:30 PM', fee: 850 },
  { id: 401, departmentId: 4, departmentName: 'General & Internal Medicine', display_name: 'Dr. Sharmistha Bhattacharya', qualification: 'MBBS, MD (Medicine)', designation: 'Consultant Physician', experienceYears: 15, rating: 4.8, reviews: 2110, average_consultation_minutes: 15, room: 'General OPD - Room 101', opdTiming: '09:00 AM - 01:00 PM', fee: 700 },
  { id: 501, departmentId: 5, departmentName: 'Gastroenterology & Hepatology', display_name: 'Dr. Souvik Banerjee', qualification: 'MBBS, MD, DNB (Gastro)', designation: 'Consultant Gastroenterologist', experienceYears: 12, rating: 4.7, reviews: 980, average_consultation_minutes: 15, room: 'Endoscopy Suite - Room 305', opdTiming: '10:30 AM - 02:00 PM', fee: 850 },
  { id: 601, departmentId: 6, departmentName: 'Nephrology & Renal Sciences', display_name: 'Dr. Anirban Majumder', qualification: 'MBBS, MD, DM (Nephrology)', designation: 'Senior Consultant Nephrologist', experienceYears: 16, rating: 4.9, reviews: 1470, average_consultation_minutes: 15, room: 'Renal Sciences - Room 208', opdTiming: '11:00 AM - 03:00 PM', fee: 900 },

  // 1. General Medicine
  { id: 201, departmentId: 101, departmentName: 'General Medicine', display_name: 'Dr. Ananya Rao', qualification: 'MBBS, MD - General Medicine (AIIMS Delhi)', experienceYears: 14, rating: 4.9, reviews: 1540, average_consultation_minutes: 10, room: 'Room 102, 1st Floor', opdTiming: '09:00 AM - 01:30 PM', fee: 200 },
  { id: 202, departmentId: 101, departmentName: 'General Medicine', display_name: 'Dr. Karan Mehta', qualification: 'MBBS, DNB - Internal Medicine (Sir Ganga Ram Hospital)', experienceYears: 9, rating: 4.8, reviews: 980, average_consultation_minutes: 12, room: 'Room 103, 1st Floor', opdTiming: '10:00 AM - 02:00 PM', fee: 200 },
  { id: 203, departmentId: 101, departmentName: 'General Medicine', display_name: 'Dr. Rajesh Gupta', qualification: 'MBBS, MD - Senior Physician & Diabetologist', experienceYears: 22, rating: 4.9, reviews: 2420, average_consultation_minutes: 10, room: 'Room 104, 1st Floor', opdTiming: '09:30 AM - 01:00 PM', fee: 250 },
  { id: 204, departmentId: 101, departmentName: 'General Medicine', display_name: 'Dr. Sunita Sharma', qualification: 'MBBS, MD - Family Medicine & Geriatric Health', experienceYears: 17, rating: 4.8, reviews: 1670, average_consultation_minutes: 10, room: 'Room 105, 1st Floor', opdTiming: '11:00 AM - 03:00 PM', fee: 200 },
  { id: 205, departmentId: 101, departmentName: 'General Medicine', display_name: 'Dr. Alok Nath', qualification: 'MBBS, MD - Infectious Diseases & Tropical Medicine', experienceYears: 13, rating: 4.7, reviews: 1210, average_consultation_minutes: 10, room: 'Room 106, 1st Floor', opdTiming: '08:30 AM - 12:30 PM', fee: 200 },

  // 2. Cardiology
  { id: 206, departmentId: 102, departmentName: 'Cardiology', display_name: 'Dr. Neha Shah', qualification: 'MBBS, MD, DM - Cardiology (PGI Chandigarh)', experienceYears: 16, rating: 4.9, reviews: 2180, average_consultation_minutes: 15, room: 'Heart Center, Room 204', opdTiming: '10:00 AM - 02:30 PM', fee: 400 },
  { id: 207, departmentId: 102, departmentName: 'Cardiology', display_name: 'Dr. Vikram Singhania', qualification: 'MBBS, MD, DNB - Interventional Cardiology & TAVR', experienceYears: 14, rating: 4.8, reviews: 1430, average_consultation_minutes: 15, room: 'Heart Center, Room 205', opdTiming: '11:00 AM - 03:00 PM', fee: 350 },
  { id: 208, departmentId: 102, departmentName: 'Cardiology', display_name: 'Dr. R. Iyer', qualification: 'MBBS, MD, DM - Heart Failure & Pacemaker Specialist', experienceYears: 23, rating: 4.9, reviews: 2890, average_consultation_minutes: 12, room: 'Heart Center, Room 206', opdTiming: '09:00 AM - 01:00 PM', fee: 450 },
  { id: 209, departmentId: 102, departmentName: 'Cardiology', display_name: 'Dr. Pradeep Joshi', qualification: 'MBBS, MD, DM - Non-Invasive & Preventive Cardiology', experienceYears: 12, rating: 4.7, reviews: 1150, average_consultation_minutes: 12, room: 'Heart Center, Room 207', opdTiming: '09:30 AM - 01:30 PM', fee: 300 },
  { id: 210, departmentId: 102, departmentName: 'Cardiology', display_name: 'Dr. Meenakshi Sundaram', qualification: 'MBBS, MS, M.Ch - Cardiothoracic & Vascular Surgeon', experienceYears: 19, rating: 4.9, reviews: 2120, average_consultation_minutes: 18, room: 'Heart Center, Room 208', opdTiming: '10:30 AM - 02:00 PM', fee: 500 },

  // 3. Dermatology & Skin Care
  { id: 211, departmentId: 103, departmentName: 'Dermatology & Skin Care', display_name: 'Dr. Sana Ali', qualification: 'MBBS, MD - Dermatology & Cosmetology (AIIMS Delhi)', experienceYears: 11, rating: 4.9, reviews: 1480, average_consultation_minutes: 10, room: 'OPD Block B, Room 121', opdTiming: '09:00 AM - 01:30 PM', fee: 250 },
  { id: 212, departmentId: 103, departmentName: 'Dermatology & Skin Care', display_name: 'Dr. Rohit Khanna', qualification: 'MBBS, DVD, DNB - Clinical Dermatology & Laser Specialist', experienceYears: 15, rating: 4.8, reviews: 1620, average_consultation_minutes: 12, room: 'OPD Block B, Room 122', opdTiming: '10:00 AM - 02:00 PM', fee: 300 },
  { id: 213, departmentId: 103, departmentName: 'Dermatology & Skin Care', display_name: 'Dr. Divya Aggarwal', qualification: 'MBBS, MD - Trichology & Dermato-Surgeon', experienceYears: 9, rating: 4.9, reviews: 920, average_consultation_minutes: 10, room: 'OPD Block B, Room 123', opdTiming: '11:00 AM - 03:00 PM', fee: 250 },
  { id: 214, departmentId: 103, departmentName: 'Dermatology & Skin Care', display_name: 'Dr. Tanvi Deshmukh', qualification: 'MBBS, DDVL - Aesthetic & Pediatric Dermatology', experienceYears: 13, rating: 4.8, reviews: 1340, average_consultation_minutes: 10, room: 'OPD Block B, Room 124', opdTiming: '09:30 AM - 01:00 PM', fee: 250 },
  { id: 215, departmentId: 103, departmentName: 'Dermatology & Skin Care', display_name: 'Dr. Pranav Joshi', qualification: 'MBBS, MD - Phototherapy, Acne & Psoriasis Clinic', experienceYears: 18, rating: 4.9, reviews: 1870, average_consultation_minutes: 15, room: 'Skin Center, Room 128', opdTiming: '10:30 AM - 02:30 PM', fee: 350 },

  // 4. Orthopedics & Joint Replacement
  { id: 216, departmentId: 104, departmentName: 'Orthopedics & Joint Replacement', display_name: 'Dr. Arjun Nair', qualification: 'MBBS, MS - Ortho (Joint Replacement Specialist, CMC Vellore)', experienceYears: 18, rating: 4.9, reviews: 1890, average_consultation_minutes: 12, room: 'Surgical Block, Room 110', opdTiming: '09:00 AM - 01:00 PM', fee: 350 },
  { id: 217, departmentId: 104, departmentName: 'Orthopedics & Joint Replacement', display_name: 'Dr. Kavita Rao', qualification: 'MBBS, D.Ortho, M.Ch - Arthroscopy & Sports Injuries', experienceYears: 11, rating: 4.8, reviews: 990, average_consultation_minutes: 10, room: 'Surgical Block, Room 111', opdTiming: '10:30 AM - 02:30 PM', fee: 300 },
  { id: 218, departmentId: 104, departmentName: 'Orthopedics & Joint Replacement', display_name: 'Dr. Manish Kapoor', qualification: 'MBBS, MS - Ortho (Robotic Knee & Spine Surgery)', experienceYears: 16, rating: 4.9, reviews: 1540, average_consultation_minutes: 15, room: 'Surgical Block, Room 112', opdTiming: '09:30 AM - 01:30 PM', fee: 350 },
  { id: 219, departmentId: 104, departmentName: 'Orthopedics & Joint Replacement', display_name: 'Dr. Harish Chandra', qualification: 'MBBS, DNB - Ortho (Trauma & Fracture Reconstructive Care)', experienceYears: 14, rating: 4.7, reviews: 1120, average_consultation_minutes: 12, room: 'Surgical Block, Room 114', opdTiming: '11:00 AM - 03:00 PM', fee: 300 },

  // 5. Pediatrics & Child Health
  { id: 220, departmentId: 105, departmentName: 'Pediatrics & Child Health', display_name: 'Dr. Maya Joshi', qualification: 'MBBS, MD - Pediatrics (Neonatology Fellowship - AIIMS)', experienceYears: 14, rating: 4.9, reviews: 2080, average_consultation_minutes: 10, room: 'Mother & Child Block, Room 116', opdTiming: '09:00 AM - 01:30 PM', fee: 250 },
  { id: 221, departmentId: 105, departmentName: 'Pediatrics & Child Health', display_name: 'Dr. Vivek Rao', qualification: 'MBBS, DCH, DNB - Senior Pediatrician & Child Immunization', experienceYears: 16, rating: 4.8, reviews: 1460, average_consultation_minutes: 10, room: 'Mother & Child Block, Room 117', opdTiming: '11:00 AM - 03:00 PM', fee: 250 },
  { id: 222, departmentId: 105, departmentName: 'Pediatrics & Child Health', display_name: 'Dr. Shilpa Kulkarni', qualification: 'MBBS, MD - Child Pulmonology & Allergy Specialist', experienceYears: 10, rating: 4.9, reviews: 1120, average_consultation_minutes: 12, room: 'Mother & Child Block, Room 118', opdTiming: '10:00 AM - 02:00 PM', fee: 250 },
  { id: 223, departmentId: 105, departmentName: 'Pediatrics & Child Health', display_name: 'Dr. Rohan Mathur', qualification: 'MBBS, DCH - Adolescent Health & Developmental Pediatrics', experienceYears: 12, rating: 4.7, reviews: 970, average_consultation_minutes: 10, room: 'Mother & Child Block, Room 119', opdTiming: '09:30 AM - 01:00 PM', fee: 200 },

  // 6. Obstetrics & Gynecology
  { id: 224, departmentId: 106, departmentName: 'Obstetrics & Gynecology', display_name: 'Dr. Shweta Bansal', qualification: 'MBBS, MS - Obs & Gynae, FICOG (Laparoscopic Surgeon)', experienceYears: 17, rating: 4.9, reviews: 2420, average_consultation_minutes: 12, room: "Women's Health Pavilion, Room 212", opdTiming: '09:00 AM - 02:00 PM', fee: 300 },
  { id: 225, departmentId: 106, departmentName: 'Obstetrics & Gynecology', display_name: 'Dr. Ritu Malhotra', qualification: 'MBBS, MD - High-Risk Pregnancy & Fetal Medicine Specialist', experienceYears: 14, rating: 4.8, reviews: 1680, average_consultation_minutes: 15, room: "Women's Health Pavilion, Room 214", opdTiming: '10:00 AM - 02:30 PM', fee: 300 },
  { id: 226, departmentId: 106, departmentName: 'Obstetrics & Gynecology', display_name: 'Dr. Smita Patil', qualification: 'MBBS, DGO, DNB - Infertility, IVF & Reproductive Endocrinology', experienceYears: 13, rating: 4.9, reviews: 1390, average_consultation_minutes: 15, room: "Women's Health Pavilion, Room 216", opdTiming: '11:00 AM - 03:00 PM', fee: 350 },

  // 7. ENT (Ear, Nose & Throat)
  { id: 227, departmentId: 107, departmentName: 'ENT (Ear, Nose & Throat)', display_name: 'Dr. Alok Kumar', qualification: 'MBBS, MS - ENT (Head & Neck Micro-Surgeon)', experienceYears: 14, rating: 4.8, reviews: 1040, average_consultation_minutes: 10, room: 'OPD Block B, Room 125', opdTiming: '09:00 AM - 01:00 PM', fee: 250 },
  { id: 228, departmentId: 107, departmentName: 'ENT (Ear, Nose & Throat)', display_name: 'Dr. Shalini Varma', qualification: 'MBBS, DLO, DNB - Cochlear Implants & Audiology Specialist', experienceYears: 12, rating: 4.9, reviews: 1280, average_consultation_minutes: 12, room: 'OPD Block B, Room 126', opdTiming: '10:30 AM - 02:30 PM', fee: 300 },
  { id: 229, departmentId: 107, departmentName: 'ENT (Ear, Nose & Throat)', display_name: 'Dr. Nitin Saxena', qualification: 'MBBS, MS - ENT (Endoscopic Sinus & Rhinoplasty Specialist)', experienceYears: 16, rating: 4.7, reviews: 990, average_consultation_minutes: 10, room: 'OPD Block B, Room 127', opdTiming: '09:30 AM - 01:30 PM', fee: 250 },

  // 8. Ophthalmology (Eye Care)
  { id: 230, departmentId: 108, departmentName: 'Ophthalmology (Eye Care)', display_name: 'Dr. Priyanka Sen', qualification: 'MBBS, MS - Ophthalmology (Cornea & LASIK Specialist)', experienceYears: 13, rating: 4.8, reviews: 980, average_consultation_minutes: 10, room: 'Vision Pavilion, Room 131', opdTiming: '09:30 AM - 01:30 PM', fee: 250 },
  { id: 231, departmentId: 108, departmentName: 'Ophthalmology (Eye Care)', display_name: 'Dr. Sameer Kaul', qualification: 'MBBS, MS, FRCS - Retina & Vitreous Specialist', experienceYears: 17, rating: 4.9, reviews: 1520, average_consultation_minutes: 12, room: 'Vision Pavilion, Room 132', opdTiming: '10:00 AM - 02:00 PM', fee: 350 },
  { id: 232, departmentId: 108, departmentName: 'Ophthalmology (Eye Care)', display_name: 'Dr. Tarun Grover', qualification: 'MBBS, DO, DNB - Cataract & Glaucoma Microsurgeon', experienceYears: 15, rating: 4.8, reviews: 1140, average_consultation_minutes: 10, room: 'Vision Pavilion, Room 134', opdTiming: '11:00 AM - 03:00 PM', fee: 300 },

  // 9. Neurology & Stroke Care
  { id: 233, departmentId: 109, departmentName: 'Neurology & Stroke Care', display_name: 'Dr. Siddharth Verma', qualification: 'MBBS, MD, DM - Neurology (NIMHANS)', experienceYears: 18, rating: 4.9, reviews: 1620, average_consultation_minutes: 20, room: 'Neuroscience Wing, Room 302', opdTiming: '10:00 AM - 02:00 PM', fee: 450 },
  { id: 234, departmentId: 109, departmentName: 'Neurology & Stroke Care', display_name: 'Dr. Preeti Sen', qualification: 'MBBS, MD, DM - Acute Stroke Care & Epilepsy Clinic', experienceYears: 13, rating: 4.8, reviews: 1180, average_consultation_minutes: 18, room: 'Neuroscience Wing, Room 304', opdTiming: '09:30 AM - 01:30 PM', fee: 400 },
  { id: 235, departmentId: 109, departmentName: 'Neurology & Stroke Care', display_name: 'Dr. Farhan Qureshi', qualification: 'MBBS, MD, DM - Movement Disorders & Neuropathy', experienceYears: 15, rating: 4.8, reviews: 1090, average_consultation_minutes: 18, room: 'Neuroscience Wing, Room 305', opdTiming: '11:00 AM - 03:00 PM', fee: 400 },

  // 10. Neurosurgery & Spine Surgery
  { id: 236, departmentId: 110, departmentName: 'Neurosurgery & Spine Surgery', display_name: 'Dr. Aditya Narayan', qualification: 'MBBS, MS, M.Ch - Brain & Spine Micro-Neurosurgery', experienceYears: 16, rating: 4.9, reviews: 1410, average_consultation_minutes: 20, room: 'Neuroscience Wing, Room 308', opdTiming: '10:00 AM - 02:00 PM', fee: 500 },
  { id: 237, departmentId: 110, departmentName: 'Neurosurgery & Spine Surgery', display_name: 'Dr. Hemant Bhardwaj', qualification: 'MBBS, MS, M.Ch - Minimally Invasive Endoscopic Spine Surgery', experienceYears: 14, rating: 4.8, reviews: 1150, average_consultation_minutes: 20, room: 'Neuroscience Wing, Room 310', opdTiming: '11:00 AM - 03:00 PM', fee: 500 },

  // 11. Gastroenterology & Liver Clinic
  { id: 238, departmentId: 111, departmentName: 'Gastroenterology & Liver Clinic', display_name: 'Dr. Deepak Chawla', qualification: 'MBBS, MD, DM - Gastroenterology & Hepatology (AIIMS)', experienceYears: 16, rating: 4.9, reviews: 1470, average_consultation_minutes: 15, room: 'Digestive Sciences, Room 218', opdTiming: '09:30 AM - 01:30 PM', fee: 400 },
  { id: 239, departmentId: 111, departmentName: 'Gastroenterology & Liver Clinic', display_name: 'Dr. Vineet Ahuja', qualification: 'MBBS, MD, DM - Therapeutic Endoscopy & IBD Specialist', experienceYears: 14, rating: 4.8, reviews: 1210, average_consultation_minutes: 15, room: 'Digestive Sciences, Room 220', opdTiming: '10:30 AM - 02:30 PM', fee: 350 },

  // 12. Pulmonology & Respiratory Medicine
  { id: 240, departmentId: 112, departmentName: 'Pulmonology & Respiratory Medicine', display_name: 'Dr. Arvind Mohan', qualification: 'MBBS, MD, DM - Pulmonary Medicine & Sleep Clinic', experienceYears: 17, rating: 4.9, reviews: 1390, average_consultation_minutes: 15, room: 'Respiratory Care, Room 140', opdTiming: '09:00 AM - 01:00 PM', fee: 350 },
  { id: 241, departmentId: 112, departmentName: 'Pulmonology & Respiratory Medicine', display_name: 'Dr. Seema Kashyap', qualification: 'MBBS, MD, DNB - Asthma, Allergy & Bronchoscopy', experienceYears: 12, rating: 4.8, reviews: 980, average_consultation_minutes: 12, room: 'Respiratory Care, Room 142', opdTiming: '10:30 AM - 02:30 PM', fee: 300 },

  // 13. Endocrinology & Diabetology
  { id: 242, departmentId: 113, departmentName: 'Endocrinology & Diabetology', display_name: 'Dr. Nikhil Tandon', qualification: 'MBBS, MD, DM - Endocrinology & Diabetes (AIIMS)', experienceYears: 19, rating: 4.9, reviews: 1820, average_consultation_minutes: 15, room: 'Metabolic Wing, Room 108', opdTiming: '09:30 AM - 01:30 PM', fee: 400 },
  { id: 243, departmentId: 113, departmentName: 'Endocrinology & Diabetology', display_name: 'Dr. Aparna Singhal', qualification: 'MBBS, MD, DNB - Thyroid Disorders & Metabolic Health', experienceYears: 11, rating: 4.8, reviews: 890, average_consultation_minutes: 12, room: 'Metabolic Wing, Room 110', opdTiming: '11:00 AM - 03:00 PM', fee: 300 },

  // 14. Nephrology & Renal Care
  { id: 244, departmentId: 114, departmentName: 'Nephrology & Renal Care', display_name: 'Dr. Sanjay Agarwal', qualification: 'MBBS, MD, DM - Nephrology & Renal Transplant Care', experienceYears: 18, rating: 4.9, reviews: 1450, average_consultation_minutes: 18, room: 'Renal Care Block, Room 225', opdTiming: '09:00 AM - 01:00 PM', fee: 450 },
  { id: 245, departmentId: 114, departmentName: 'Nephrology & Renal Care', display_name: 'Dr. Rashmi Bagga', qualification: 'MBBS, MD, DNB - Dialysis & Glomerular Diseases', experienceYears: 13, rating: 4.8, reviews: 970, average_consultation_minutes: 15, room: 'Renal Care Block, Room 226', opdTiming: '10:30 AM - 02:30 PM', fee: 350 },

  // 15. Urology & Andrology
  { id: 246, departmentId: 115, departmentName: 'Urology & Andrology', display_name: 'Dr. Rajiv Goel', qualification: 'MBBS, MS, M.Ch - Laser Urology & Kidney Stones Specialist', experienceYears: 16, rating: 4.9, reviews: 1630, average_consultation_minutes: 15, room: 'Surgical Block, Room 118', opdTiming: '09:30 AM - 01:30 PM', fee: 400 },
  { id: 247, departmentId: 115, departmentName: 'Urology & Andrology', display_name: 'Dr. Mohit Khera', qualification: 'MBBS, MS, DNB - Prostate & Reconstructive Urology', experienceYears: 12, rating: 4.7, reviews: 1040, average_consultation_minutes: 12, room: 'Surgical Block, Room 119', opdTiming: '11:00 AM - 03:00 PM', fee: 350 },

  // 16. General & Laparoscopic Surgery
  { id: 248, departmentId: 116, departmentName: 'General & Laparoscopic Surgery', display_name: 'Dr. Ashish Chauhan', qualification: 'MBBS, MS - General & Advanced Laparoscopic Surgery', experienceYears: 17, rating: 4.9, reviews: 1760, average_consultation_minutes: 15, room: 'Surgical Block, Room 115', opdTiming: '09:00 AM - 01:00 PM', fee: 350 },
  { id: 249, departmentId: 116, departmentName: 'General & Laparoscopic Surgery', display_name: 'Dr. Meera Nambiar', qualification: 'MBBS, MS, FMAS - Gastrointestinal & Hernia Specialist', experienceYears: 13, rating: 4.8, reviews: 1180, average_consultation_minutes: 12, room: 'Surgical Block, Room 116', opdTiming: '10:30 AM - 02:30 PM', fee: 300 },

  // 17. Oncology & Cancer Care
  { id: 250, departmentId: 117, departmentName: 'Oncology & Cancer Care', display_name: 'Dr. Vinod Raina', qualification: 'MBBS, MD, DM - Medical Oncology (AIIMS Delhi)', experienceYears: 24, rating: 4.9, reviews: 2940, average_consultation_minutes: 20, room: 'Cancer Center, Room 402', opdTiming: '09:00 AM - 01:30 PM', fee: 500 },
  { id: 251, departmentId: 117, departmentName: 'Oncology & Cancer Care', display_name: 'Dr. Shubham Garg', qualification: 'MBBS, MS, M.Ch - Surgical Oncology & Robotic Care', experienceYears: 15, rating: 4.9, reviews: 1510, average_consultation_minutes: 20, room: 'Cancer Center, Room 404', opdTiming: '10:00 AM - 02:00 PM', fee: 500 },

  // 18. Psychiatry & Behavioral Health
  { id: 252, departmentId: 118, departmentName: 'Psychiatry & Behavioral Health', display_name: 'Dr. Harish Shetty', qualification: 'MBBS, MD - Psychiatry (Counseling & Neuro-Psychiatry)', experienceYears: 18, rating: 4.9, reviews: 1670, average_consultation_minutes: 25, room: 'Mind & Wellness Wing, Room 315', opdTiming: '09:30 AM - 02:00 PM', fee: 400 },
  { id: 253, departmentId: 118, departmentName: 'Psychiatry & Behavioral Health', display_name: 'Dr. Ananya Mukherjee', qualification: 'MBBS, DPM, DNB - Clinical Psychiatry & Anxiety Disorders', experienceYears: 11, rating: 4.8, reviews: 1040, average_consultation_minutes: 20, room: 'Mind & Wellness Wing, Room 316', opdTiming: '11:00 AM - 03:00 PM', fee: 350 },

  // 19. Rheumatology & Clinical Immunology
  { id: 254, departmentId: 119, departmentName: 'Rheumatology & Clinical Immunology', display_name: 'Dr. Uma Kumar', qualification: 'MBBS, MD, DM - Rheumatology (AIIMS Delhi)', experienceYears: 20, rating: 4.9, reviews: 1830, average_consultation_minutes: 15, room: 'OPD Block A, Room 105', opdTiming: '09:00 AM - 01:00 PM', fee: 450 },
  { id: 255, departmentId: 119, departmentName: 'Rheumatology & Clinical Immunology', display_name: 'Dr. Gaurav Pathak', qualification: 'MBBS, MD, DNB - Arthritis & Autoimmune Clinic', experienceYears: 12, rating: 4.8, reviews: 920, average_consultation_minutes: 15, room: 'OPD Block A, Room 106', opdTiming: '10:30 AM - 02:30 PM', fee: 350 },

  // 20. Dental & Maxillofacial Surgery
  { id: 256, departmentId: 120, departmentName: 'Dental & Maxillofacial Surgery', display_name: 'Dr. Rohit Batra', qualification: 'BDS, MDS - Oral & Maxillofacial Surgeon', experienceYears: 14, rating: 4.8, reviews: 1290, average_consultation_minutes: 15, room: 'Dental Clinic, Room 136', opdTiming: '09:00 AM - 01:30 PM', fee: 200 },
  { id: 257, departmentId: 120, departmentName: 'Dental & Maxillofacial Surgery', display_name: 'Dr. Shilpa Sethi', qualification: 'BDS, MDS - Conservative Dentistry & Endodontist (RCT)', experienceYears: 11, rating: 4.9, reviews: 1150, average_consultation_minutes: 15, room: 'Dental Clinic, Room 137', opdTiming: '10:00 AM - 02:30 PM', fee: 200 },

  // 21. Plastic & Cosmetic Surgery
  { id: 258, departmentId: 121, departmentName: 'Plastic & Cosmetic Surgery', display_name: 'Dr. Lokesh Kumar', qualification: 'MBBS, MS, M.Ch - Aesthetic & Reconstructive Plastic Surgery', experienceYears: 21, rating: 4.9, reviews: 1720, average_consultation_minutes: 20, room: 'Surgical Block, Room 120', opdTiming: '10:00 AM - 02:00 PM', fee: 450 },
  { id: 259, departmentId: 121, departmentName: 'Plastic & Cosmetic Surgery', display_name: 'Dr. Sonali Gupta', qualification: 'MBBS, MS, DNB - Burn Care & Hand Trauma Surgery', experienceYears: 13, rating: 4.8, reviews: 980, average_consultation_minutes: 15, room: 'Surgical Block, Room 121', opdTiming: '11:00 AM - 03:00 PM', fee: 350 },

  // 22. Physical Medicine & Rehabilitation
  { id: 260, departmentId: 122, departmentName: 'Physical Medicine & Rehabilitation', display_name: 'Dr. Sanjay Wadhwa', qualification: 'MBBS, MD - Physical Medicine & Rehabilitation (AIIMS)', experienceYears: 19, rating: 4.9, reviews: 1480, average_consultation_minutes: 20, room: 'Rehab Pavilion, Room 101', opdTiming: '09:00 AM - 01:00 PM', fee: 300 },
  { id: 261, departmentId: 122, departmentName: 'Physical Medicine & Rehabilitation', display_name: 'Dr. Neeraj Bansal', qualification: 'BPT, MPT - Musculoskeletal & Stroke Physiotherapy', experienceYears: 12, rating: 4.8, reviews: 1120, average_consultation_minutes: 20, room: 'Rehab Pavilion, Room 102', opdTiming: '10:30 AM - 02:30 PM', fee: 200 },

  // 23. Hematology & Bone Marrow
  { id: 262, departmentId: 123, departmentName: 'Hematology & Bone Marrow', display_name: 'Dr. Lalit Kumar', qualification: 'MBBS, MD, DM - Hematology & Bone Marrow Transplant Specialist', experienceYears: 23, rating: 4.9, reviews: 1960, average_consultation_minutes: 20, room: 'Hematology Wing, Room 406', opdTiming: '09:30 AM - 01:30 PM', fee: 500 },
  { id: 263, departmentId: 123, departmentName: 'Hematology & Bone Marrow', display_name: 'Dr. Shweta Rawat', qualification: 'MBBS, MD, DNB - Anemia, Coagulation & Bleeding Disorders', experienceYears: 11, rating: 4.8, reviews: 890, average_consultation_minutes: 15, room: 'Hematology Wing, Room 407', opdTiming: '11:00 AM - 03:00 PM', fee: 400 },

  // 24. Geriatric Medicine (Elder Care)
  { id: 264, departmentId: 124, departmentName: 'Geriatric Medicine (Elder Care)', display_name: 'Dr. A. B. Dey', qualification: 'MBBS, MD - Geriatric Medicine Specialist (AIIMS Delhi)', experienceYears: 25, rating: 4.9, reviews: 2210, average_consultation_minutes: 20, room: 'Wellness Pavilion, Room 107', opdTiming: '09:00 AM - 01:30 PM', fee: 350 },
  { id: 265, departmentId: 124, departmentName: 'Geriatric Medicine (Elder Care)', display_name: 'Dr. Madhu Chopra', qualification: 'MBBS, MD - Senior Citizen Health & Memory Clinic', experienceYears: 16, rating: 4.8, reviews: 1340, average_consultation_minutes: 18, room: 'Wellness Pavilion, Room 108', opdTiming: '10:30 AM - 02:30 PM', fee: 300 },

  // 25. Dietetics & Clinical Nutrition
  { id: 266, departmentId: 125, departmentName: 'Dietetics & Clinical Nutrition', display_name: 'Dr. Ritika Samaddar', qualification: 'M.Sc, Ph.D - Clinical Nutrition & Lifestyle Health', experienceYears: 18, rating: 4.9, reviews: 1840, average_consultation_minutes: 15, room: 'Nutritional Care, Room 109', opdTiming: '09:30 AM - 02:00 PM', fee: 200 },
  { id: 267, departmentId: 125, departmentName: 'Dietetics & Clinical Nutrition', display_name: 'Dr. Anjali Anand', qualification: 'M.Sc - Diabetes Educator & Renal Nutrition Specialist', experienceYears: 12, rating: 4.8, reviews: 1090, average_consultation_minutes: 15, room: 'Nutritional Care, Room 110', opdTiming: '11:00 AM - 03:00 PM', fee: 200 },
]

export const doctorsByDept = {
  'General Medicine': ['Dr. Ananya Rao', 'Dr. Karan Mehta'],
  Cardiology: ['Dr. Neha Shah', 'Dr. R. Iyer'],
  Orthopedics: ['Dr. Arjun Nair', 'Dr. Kavita Rao'],
  Dermatology: ['Dr. Sana Ali', 'Dr. P. Menon'],
  Pediatrics: ['Dr. Maya Joshi', 'Dr. Vivek Rao'],
}

/**
 * Returns randomized doctors for the selected department
 */
export function getRandomDoctorsForDepartment(deptIdentifier, count = 6) {
  const targetId = String(deptIdentifier || '').toLowerCase().trim()
  const matching = richDoctors.filter(doc => {
    const dName = doc.departmentName.toLowerCase()
    return String(doc.departmentId) === targetId ||
      dName === targetId ||
      dName.includes(targetId) ||
      targetId.includes(dName.slice(0, 5))
  })

  const pool = matching.length > 0 ? matching : richDoctors
  // Return shuffled array of doctors for that department
  const shuffled = [...pool].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, Math.min(count, shuffled.length))
}

export function createDoctorDirectory(random = Math.random) {
  return Object.entries(doctorsByDept).flatMap(([department, doctors]) => doctors.map(name => ({
    id: `${department}::${name}`,
    name,
    department,
    experienceYears: 5 + Math.floor(random() * 20),
    rating: Number((4.3 + random() * 0.7).toFixed(1)),
    patientsToday: 8 + Math.floor(random() * 19),
    availableSlots: 1 + Math.floor(random() * 7),
    averageMinutes: 10 + Math.floor(random() * 16),
  })))
}

export const navItems = [
  { id: 'home', label: 'Home', icon: HeartPulse },
  { id: 'book', label: 'Book', icon: Ticket },
  { id: 'queue', label: 'Queue', icon: Activity },
  { id: 'nearby', label: 'Nearby', icon: MapPin },
  { id: 'staff', label: 'Staff', icon: BriefcaseMedical },
]

export const hospitalKey = hospital => `${hospital.city}::${hospital.name}`
export const opdKey = (hospital, department) => `${hospitalKey(hospital)}::${department}`

export function loadJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback
  } catch {
    return fallback
  }
}

export function persistJson(key, value) {
  const json = JSON.stringify(value)
  if (localStorage.getItem(key) !== json) localStorage.setItem(key, json)
}

export const PHOTON_API = 'https://photon.komoot.io'

export function deriveNameFromEmail(email, fallback = 'Patient User') {
  if (!email || typeof email !== 'string') return fallback
  const username = email.trim().split('@')[0]
  if (!username) return fallback

  const parts = username
    .replace(/[._+\-]+/g, ' ')
    .replace(/\d+/g, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length === 0) {
    const rawClean = username.replace(/[._+\-]+/g, ' ').trim()
    if (!rawClean) return fallback
    return rawClean.charAt(0).toUpperCase() + rawClean.slice(1)
  }

  return parts
    .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(' ')
}

export function distanceKm(from, to) {
  const radians = degrees => degrees * Math.PI / 180
  const latitude = radians(to.lat - from.lat)
  const longitude = radians(to.lon - from.lon)
  const arc = Math.sin(latitude / 2) ** 2
    + Math.cos(radians(from.lat)) * Math.cos(radians(to.lat)) * Math.sin(longitude / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc))
}
