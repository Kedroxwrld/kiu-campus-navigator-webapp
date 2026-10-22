/* ============================================================================
   KIU Campus Navigator — campus dataset
   Kampala International University, Main Campus, Kansanga (Ggaba Road), Kampala

   All geometry below is expressed in LOCAL CAMPUS METRES:
     x = metres EAST  of the campus origin
     y = metres NORTH of the campus origin
   The projection to WGS84 happens in router.js / map.js, so distances and
   walking times stay metric-accurate.
   ========================================================================== */

window.KIU_DATA = (function () {
  'use strict';

  /* ----------------------------------------------------------------- meta */
  var meta = {
    university: 'Kampala International University',
    campusName: 'KIU Main Campus — Kansanga',
    campusShort: 'Main Campus · Kansanga',
    address: 'Ggaba Road, Kansanga, Kampala, Uganda',
    coordinates: { lat: 0.31658, lng: 32.59832 },
    mPerDegLat: 111320,
    walkingSpeed: 1.35, // metres per second (calm campus pace)
    openingHour: '6:00',
    closingHour: '22:00'
  };

  /* ----------------------------------------------------------- categories */
  var categories = [
    {
      id: 'academic',
      label: 'Faculties & Halls',
      short: 'Faculties',
      color: '#006837',
      soft: '#E6F4EA',
      icon: 'i-school',
      blurb: 'Teaching blocks, faculties and clinical facilities'
    },
    {
      id: 'admin',
      label: 'Administrative Offices',
      short: 'Offices',
      color: '#0F766E',
      soft: '#E1F3F1',
      icon: 'i-building',
      blurb: 'Registry, finance, guild and ICT units'
    },
    {
      id: 'services',
      label: 'Student Services & Amenities',
      short: 'Amenities',
      color: '#B45309',
      soft: '#FBEDDC',
      icon: 'i-sparkle',
      blurb: 'Library, clinic, food, sport, hostels and transport'
    }
  ];

  /* ------------------------------------------------------- quick filters */
  var quickFilters = [
    { id: 'library', label: 'Library', icon: 'i-book' },
    { id: 'food', label: 'Food', icon: 'i-coffee' },
    { id: 'atm', label: 'ATM', icon: 'i-atm' },
    { id: 'sports', label: 'Sports', icon: 'i-dumbbell' },
    { id: 'hostels', label: 'Hostels', icon: 'i-hotel' },
    { id: 'ict', label: 'ICT', icon: 'i-cpu' },
    { id: 'clinic', label: 'Clinic', icon: 'i-hospital' },
    { id: 'transport', label: 'Transport', icon: 'i-bus' }
  ];

  /* --------------------------------------------------------------- roads */
  /* Each road is an open polyline of local-metre points. */
  var roads = [
    { id: 'ggaba', name: 'Ggaba Road', points: [[-350, -250], [350, -250]], external: true },
    { id: 'spine', name: 'Spine Avenue', points: [[0, -250], [0, 210]] },
    { id: 'college', name: 'College Road', points: [[-300, -140], [300, -140]] },
    { id: 'librarywalk', name: 'Library Walk', points: [[-300, 0], [300, 0]] },
    { id: 'hostelrd', name: 'Hostel Road', points: [[-300, 130], [300, 130]] },
    { id: 'westloop', name: 'West Loop', points: [[-300, -140], [-300, 130]] },
    { id: 'eastloop', name: 'East Loop', points: [[300, -140], [300, 130]] },
    { id: 'hospitaldr', name: 'Hospital Drive', points: [[-120, 210], [160, 210]] }
  ];

  /* ---------------------------------------------- green space & hardscape */
  var greens = [
    { id: 'lawn-north', name: 'Central Lawn', points: [[-20, 140], [30, 140], [30, 205], [-20, 205]] },
    { id: 'lawn-west', name: 'Faculty Garden', points: [[-185, -40], [-95, -40], [-95, -5], [-185, -5]] },
    { id: 'lawn-green', name: 'The Green', points: [[20, -50], [190, -50], [190, -25], [20, -25]] }
  ];

  var plazas = [
    { id: 'plaza-main', name: 'Administration Plaza', points: [[-150, -166], [-55, -166], [-55, -143], [-150, -143]] }
  ];

  /* Campus outline (rounded rectangle in local metres) */
  var boundary = { x1: -320, y1: -262, x2: 320, y2: 216, radius: 22 };

  /* ---------------------------------------------------------- locations */
  /* rect  = building footprint {x1,y1,x2,y2}
     door  = pedestrian entrance point (on, or a few metres from, a road)
     mark  = map label / pin position                                     */
  var locations = [
    {
      id: 'gate',
      name: 'Main Gate & Security Post',
      shortName: 'Main Gate',
      category: 'services',
      icon: 'i-shield',
      rect: { x1: -14, y1: -262, x2: 14, y2: -238 },
      door: { x: 0, y: -250 },
      mark: { x: 0, y: -250 },
      blurb: 'The Kansanga main entrance on Ggaba Road, with the 24-hour security post and visitor log.',
      info: [
        { label: 'Access', value: 'Open 24 hours · visitors sign in' },
        { label: 'Nearest landmarks', value: 'Bursar, ATM point, Administration Plaza' }
      ],
      quick: [],
      tags: ['main gate', 'entrance', 'security', 'entry', 'reception', 'visitor', 'gaba road', 'ggaba road']
    },
    {
      id: 'main',
      name: 'Main Building (Administration)',
      shortName: 'Main Building',
      category: 'admin',
      icon: 'i-building',
      rect: { x1: -150, y1: -232, x2: -55, y2: -165 },
      door: { x: -102, y: -165 },
      mark: { x: -102, y: -198 },
      blurb: 'The administrative heart of KIU — Vice-Chancellor\'s office, registry reception, council chamber and the Administration Plaza.',
      info: [
        { label: 'Opening hours', value: 'Mon–Fri 8:00am – 5:00pm' },
        { label: 'Found inside', value: 'VC\'s office, Senate room, reception' },
        { label: 'Entrance', value: 'Administration Plaza side (College Road)' }
      ],
      quick: [],
      tags: ['main building', 'administration', 'administration plaza', 'vice chancellor', 'vc', 'senate', 'reception', 'registry']
    },
    {
      id: 'registrar',
      name: 'Academic Registrar (Records Office)',
      shortName: 'Academic Registrar',
      category: 'admin',
      icon: 'i-book',
      rect: { x1: -290, y1: -232, x2: -195, y2: -175 },
      door: { x: -242, y: -175 },
      mark: { x: -242, y: -203 },
      blurb: 'Student records, exam registration, transcripts, academic letters and graduation paperwork.',
      info: [
        { label: 'Opening hours', value: 'Mon–Fri 8:00am – 4:00pm' },
        { label: 'Bring', value: 'Student ID, registration slip, ID copy' },
        { label: 'Tip', value: 'Exam registration closes 7 days before the exam week' }
      ],
      quick: [],
      tags: ['registrar', 'academic registrar', 'records', 'transcripts', 'exam registration', 'exams', 'graduation', 'academic affairs']
    },
    {
      id: 'bursar',
      name: 'Bursar & Finance Office',
      shortName: 'Bursar / Finance',
      category: 'admin',
      icon: 'i-atm',
      rect: { x1: 20, y1: -132, x2: 110, y2: -55 },
      door: { x: 65, y: -132 },
      mark: { x: 65, y: -93 },
      blurb: 'Fee payments, receipts, refunds, sponsorships and student financial clearance.',
      info: [
        { label: 'Opening hours', value: 'Mon–Fri 8:00am – 4:00pm' },
        { label: 'Bring', value: 'Student ID, bank/mobile-money slip, ID copy' },
        { label: 'Tip', value: 'Keep your numbered receipt — it is required for clearance' }
      ],
      quick: [],
      tags: ['bursar', 'finance', 'fees', 'payments', 'clearance', 'receipt', 'refund', 'sponsorship']
    },
    {
      id: 'guild',
      name: 'Student Guild Council Office',
      shortName: 'Guild Office',
      category: 'admin',
      icon: 'i-star',
      rect: { x1: -185, y1: -125, x2: -95, y2: -45 },
      door: { x: -140, y: -125 },
      mark: { x: -140, y: -85 },
      blurb: 'Home of the Student Guild Council — chairperson, vice chairperson, secretary, treasurer and the welfare minister.',
      info: [
        { label: 'Opening hours', value: 'Mon–Fri 8:00am – 5:00pm' },
        { label: 'Council', value: 'Guild Chairperson · Vice · Secretary · Treasurer · Welfare' },
        { label: 'Tip', value: 'Complaints can also be logged through the student portal' }
      ],
      quick: [],
      tags: ['guild', 'guild council', 'student council', 'welfare', 'secretary', 'chairperson', 'student body']
    },
    {
      id: 'ict',
      name: 'ICT Labs & Computer Centre',
      shortName: 'ICT Labs',
      category: 'admin',
      icon: 'i-cpu',
      rect: { x1: -170, y1: 20, x2: -90, y2: 90 },
      door: { x: -130, y: 20 },
      mark: { x: -130, y: 55 },
      blurb: 'ICT Lab 1–4, the computer centre, printing and scanning, and the student Wi-Fi help desk.',
      info: [
        { label: 'Opening hours', value: 'Mon–Fri 8:00am – 10:00pm · Sat 9:00am – 6:00pm' },
        { label: 'Includes', value: 'ICT Lab 1–4, printing, network support' },
        { label: 'Tip', value: 'Bring your student email password for lab log-in' }
      ],
      quick: ['ict'],
      tags: ['ict', 'computer lab', 'ict lab 3', 'computer centre', 'lab', 'wifi', 'wi-fi', 'printing', 'internet', 'network']
    },
    {
      id: 'helpdesk',
      name: 'IT Help Desk & Wi-Fi Support',
      shortName: 'IT Help Desk',
      category: 'admin',
      icon: 'i-volume',
      rect: { x1: 120, y1: -130, x2: 190, y2: -75 },
      door: { x: 155, y: -130 },
      mark: { x: 155, y: -102 },
      blurb: 'Drop in for account lock-outs, Wi-Fi vouchers, email problems, LMS access and device set-up.',
      info: [
        { label: 'Opening hours', value: 'Mon–Fri 8:00am – 6:00pm' },
        { label: 'Walk-in', value: 'No appointment needed' }
      ],
      quick: ['ict'],
      tags: ['help desk', 'helpdesk', 'it support', 'wifi', 'wi-fi', 'voucher', 'email', 'portal', 'lms', 'password']
    },
    {
      id: 'bookshop',
      name: 'University Bookshop & Print Centre',
      shortName: 'Bookshop',
      category: 'admin',
      icon: 'i-book',
      rect: { x1: -60, y1: 20, x2: -10, y2: 75 },
      door: { x: -10, y: 47 },
      mark: { x: -35, y: 47 },
      blurb: 'Textbooks, course materials, KIU-branded stationery, printing, photocopying and binding.',
      info: [
        { label: 'Opening hours', value: 'Mon–Fri 8:00am – 6:00pm · Sat 9:00am – 4:00pm' },
        { label: 'Services', value: 'Photocopying, binding, lamination' }
      ],
      quick: [],
      tags: ['bookshop', 'books', 'textbooks', 'stationery', 'print centre', 'photocopy', 'binding', 'shop']
    },
    {
      id: 'law',
      name: 'School of Law',
      shortName: 'School of Law',
      category: 'academic',
      icon: 'i-school',
      rect: { x1: 15, y1: 20, x2: 145, y2: 110 },
      door: { x: 80, y: 20 },
      mark: { x: 80, y: 65 },
      blurb: 'School of Law — lecture theatres, the moot court chamber, legal clinic and the law library section.',
      info: [
        { label: 'Lecture halls', value: 'LT 1 – LT 4 · Moot Court' },
        { label: 'Opening hours', value: 'Mon–Fri 7:30am – 9:00pm' },
        { label: 'Tip', value: 'The legal clinic runs every Wednesday for community case support' }
      ],
      quick: [],
      tags: ['law', 'school of law', 'moot court', 'legal clinic', 'faculty', 'lectures']
    },
    {
      id: 'business',
      name: 'School of Business & Management',
      shortName: 'Business School',
      category: 'academic',
      icon: 'i-school',
      rect: { x1: -70, y1: -125, x2: -5, y2: -45 },
      door: { x: -5, y: -85 },
      mark: { x: -37, y: -85 },
      blurb: 'School of Business & Management — accounting, marketing, entrepreneurship and the business incubation desk.',
      info: [
        { label: 'Lecture halls', value: 'B-1 to B-6 · Seminar rooms' },
        { label: 'Opening hours', value: 'Mon–Fri 7:30am – 9:00pm' },
        { label: 'Tip', value: 'Incubation desk is open to student start-ups on College Road' }
      ],
      quick: [],
      tags: ['business', 'business school', 'management', 'accounting', 'marketing', 'faculty', 'entrepreneurship', 'incubation']
    },
    {
      id: 'science',
      name: 'Faculty of Science & Technology',
      shortName: 'Science & Technology',
      category: 'academic',
      icon: 'i-school',
      rect: { x1: -290, y1: 140, x2: -160, y2: 205 },
      door: { x: -225, y: 140 },
      mark: { x: -225, y: 172 },
      blurb: 'Faculty of Science & Technology — laboratories, lecture theatres and the engineering workshop.',
      info: [
        { label: 'Facilities', value: 'Physics, chemistry and biology labs · workshop' },
        { label: 'Opening hours', value: 'Mon–Fri 7:30am – 9:00pm' },
        { label: 'Tip', value: 'Lab coats and safety boots are issued at the store' }
      ],
      quick: [],
      tags: ['science', 'technology', 'engineering', 'faculty', 'laboratory', 'labs', 'workshop', 'physics', 'chemistry']
    },
    {
      id: 'postgrad',
      name: 'Postgraduate & Research Centre',
      shortName: 'Postgraduate Centre',
      category: 'academic',
      icon: 'i-school',
      rect: { x1: 215, y1: 20, x2: 295, y2: 105 },
      door: { x: 255, y: 105 },
      mark: { x: 255, y: 62 },
      blurb: 'Postgraduate teaching rooms, the research office, supervision rooms and the alumni lounge.',
      info: [
        { label: 'Opening hours', value: 'Mon–Fri 8:00am – 8:00pm' },
        { label: 'Facilities', value: 'PG halls, research office, alumni lounge' }
      ],
      quick: [],
      tags: ['postgraduate', 'postgraduate centre', 'research', 'masters', 'phd', 'alumni', 'pg', 'graduates']
    },
    {
      id: 'hospital',
      name: 'KIU Teaching Hospital & Health Sciences',
      shortName: 'KIU Teaching Hospital',
      category: 'academic',
      icon: 'i-hospital',
      rect: { x1: 30, y1: 140, x2: 170, y2: 205 },
      door: { x: 100, y: 205 },
      mark: { x: 100, y: 172 },
      blurb: 'The KIU Teaching Hospital — clinical teaching, out-patient services, pharmacy, nursing practice and the Health Sciences faculty.',
      info: [
        { label: 'Opening hours', value: 'Out-patient 24 hours · clinic 8:00am – 6:00pm' },
        { label: 'Departments', value: 'Nursing, pharmacy, physiotherapy, public health' },
        { label: 'Access', value: 'Hospital Drive, north end of campus' }
      ],
      quick: ['clinic'],
      tags: ['hospital', 'teaching hospital', 'health sciences', 'nursing', 'pharmacy', 'clinical', 'physiotherapy', 'out-patient', 'outpatient']
    },
    {
      id: 'library',
      name: 'Main University Library',
      shortName: 'Main Library',
      category: 'services',
      icon: 'i-book',
      rect: { x1: -285, y1: 15, x2: -190, y2: 110 },
      door: { x: -285, y: 62 },
      mark: { x: -237, y: 62 },
      blurb: 'The Main University Library — reference stacks, reading rooms, the e-resource hub, group study and the librarian\'s help desk.',
      info: [
        { label: 'Opening hours', value: 'Mon–Fri 8:00am – 10:00pm · Sat 9:00am – 6:00pm · Sun 2:00pm – 8:00pm' },
        { label: 'Borrowing', value: '3 books for 14 days · renew online' },
        { label: 'Rules', value: 'Silence in reading rooms · no food in the stacks · bags in lockers' },
        { label: 'Tip', value: 'Exam season hours are extended — check the notice board at the door' }
      ],
      quick: ['library'],
      tags: ['library', 'main library', 'books', 'reading room', 'study', 'e-resources', 'librarian', 'borrow', 'study room']
    },
    {
      id: 'clinic',
      name: 'University Health Clinic',
      shortName: 'Health Clinic',
      category: 'services',
      icon: 'i-hospital',
      rect: { x1: 185, y1: 145, x2: 250, y2: 195 },
      door: { x: 217, y: 145 },
      mark: { x: 217, y: 170 },
      blurb: 'Student health clinic — consultations, first aid, chronic-condition follow-up, counselling referrals and medical certificates.',
      info: [
        { label: 'Opening hours', value: 'Mon–Fri 8:00am – 5:00pm · Sat 9:00am – 1:00pm' },
        { label: 'Cost', value: 'Free for registered students' },
        { label: 'Tip', value: 'Medical certificates for the Bursar are issued here' }
      ],
      quick: ['clinic'],
      tags: ['clinic', 'health', 'medical', 'nurse', 'first aid', 'sick bay', 'counselling', 'certificate']
    },
    {
      id: 'cafe',
      name: 'Cafeteria & Food Court',
      shortName: 'Cafeteria',
      category: 'services',
      icon: 'i-coffee',
      rect: { x1: -290, y1: -130, x2: -200, y2: -60 },
      door: { x: -245, y: -130 },
      mark: { x: -245, y: -95 },
      blurb: 'Main cafeteria and food court — hot meals, tea/coffee, snacks, juice bar and outside-catering counters.',
      info: [
        { label: 'Opening hours', value: 'Mon–Sat 6:30am – 9:00pm · Sun 8:00am – 6:00pm' },
        { label: 'Includes', value: 'Hot meals, juice bar, bakery, halal & vegetarian options' },
        { label: 'Tip', value: 'Peak lunch rush is 12:00–1:30pm — come at 11:30 for no queue' }
      ],
      quick: ['food'],
      tags: ['cafeteria', 'food', 'food court', 'restaurant', 'canteen', 'lunch', 'breakfast', 'coffee', 'juice', 'eat']
    },
    {
      id: 'sports',
      name: 'Sports Field & Recreation Centre',
      shortName: 'Sports Field',
      category: 'services',
      icon: 'i-dumbbell',
      rect: { x1: 200, y1: -130, x2: 290, y2: -20 },
      door: { x: 300, y: -75 },
      mark: { x: 245, y: -75 },
      blurb: 'Football pitch, running track, basketball court, gymnasium and the sports officer\'s desk.',
      info: [
        { label: 'Opening hours', value: 'Daily 6:00am – 9:00pm' },
        { label: 'Facilities', value: 'Football, athletics track, courts, gym' },
        { label: 'Tip', value: 'Sports clubs sign up with the sports officer at the East Loop gate' }
      ],
      quick: ['sports'],
      tags: ['sports', 'sports field', 'football', 'gym', 'gymnasium', 'athletics', 'recreation', 'court', 'club', 'basketball']
    },
    {
      id: 'hostels',
      name: 'Student Hostels (Blocks A & B)',
      shortName: 'Student Hostels',
      category: 'services',
      icon: 'i-hotel',
      rect: { x1: -140, y1: 140, x2: -20, y2: 205 },
      door: { x: -80, y: 140 },
      mark: { x: -80, y: 172 },
      blurb: 'Residence halls for students — Blocks A and B, with the hostel warden\'s desk, laundry and common rooms.',
      info: [
        { label: 'Reception', value: 'Hostel warden on duty 24 hours' },
        { label: 'Facilities', value: 'Laundry, common room, study room, notice boards' },
        { label: 'Tip', value: 'Quiet hours are 10:00pm – 6:00am' }
      ],
      quick: ['hostels'],
      tags: ['hostels', 'hostel', 'residence', 'accommodation', 'warden', 'block a', 'block b', 'dormitory', 'laundry']
    },
    {
      id: 'chapel',
      name: 'KIU Chapel & Spiritual Centre',
      shortName: 'Chapel',
      category: 'services',
      icon: 'i-star',
      rect: { x1: 262, y1: 138, x2: 292, y2: 182 },
      door: { x: 277, y: 138 },
      mark: { x: 277, y: 160 },
      blurb: 'The KIU Chapel — worship services, prayer fellowships, counselling and the chaplaincy office.',
      info: [
        { label: 'Services', value: 'Sunday 9:00am & 11:00am · Wednesday 6:00pm' },
        { label: 'Access', value: 'Open to students, staff and visitors' }
      ],
      quick: [],
      tags: ['chapel', 'church', 'spiritual', 'worship', 'prayer', 'counselling', 'chaplain']
    },
    {
      id: 'atm',
      name: 'ATM & Banking Point (Main Gate)',
      shortName: 'ATM — Main Gate',
      category: 'services',
      icon: 'i-atm',
      rect: { x1: 95, y1: -235, x2: 140, y2: -215 },
      door: { x: 117, y: -235 },
      mark: { x: 117, y: -225 },
      blurb: 'Cash machine and banking counter right outside the main gate on Ggaba Road — cash, deposits and student top-ups.',
      info: [
        { label: 'Opening hours', value: 'Mon–Fri 8:00am – 6:00pm · Sat 9:00am – 4:00pm' },
        { label: 'Note', value: 'Peak queue on fee-payment days — come before 10:00am' }
      ],
      quick: ['atm'],
      tags: ['atm', 'bank', 'banking', 'cash', 'money', 'withdraw', 'main gate', 'ggaba road']
    },
    {
      id: 'atm2',
      name: 'ATM & Banking Point (Library Plaza)',
      shortName: 'ATM — Library Plaza',
      category: 'services',
      icon: 'i-atm',
      rect: { x1: 160, y1: 20, x2: 200, y2: 55 },
      door: { x: 180, y: 20 },
      mark: { x: 180, y: 37 },
      blurb: 'A second ATM on the Library Walk side of campus, next to the School of Law and the reading rooms.',
      info: [
        { label: 'Opening hours', value: 'Mon–Fri 8:00am – 6:00pm' }
      ],
      quick: ['atm'],
      tags: ['atm', 'bank', 'cash', 'money', 'library plaza', 'withdraw']
    },
    {
      id: 'transport',
      name: 'Transport & Shuttle Point',
      shortName: 'Transport / Shuttle',
      category: 'services',
      icon: 'i-bus',
      rect: { x1: 160, y1: -235, x2: 215, y2: -212 },
      door: { x: 187, y: -235 },
      mark: { x: 187, y: -223 },
      blurb: 'Campus shuttle stop and taxi-boda rank on Ggaba Road, plus the campus bus that loops to the hostels and library.',
      info: [
        { label: 'Shuttle frequency', value: 'Every 15 minutes, 7:00am – 9:00pm' },
        { label: 'Route', value: 'Main Gate → Library Walk → Hostel Road → Teaching Hospital' }
      ],
      quick: ['transport'],
      tags: ['transport', 'shuttle', 'bus', 'taxi', 'boda', 'ride', 'parking', 'commute']
    }
  ];

  /* ---------------------------------------------------------- emergency */
  /* NOTE: the KIU extensions below are placeholders — replace the numbers
     with the official lines published by the University before deploying. */
  var contacts = [
    { id: 'security', label: 'KIU Campus Security', note: 'Main Gate · 24 hours', phone: '+256 700 000 000', icon: 'i-shield', accent: 'brand', placeholder: true },
    { id: 'clinic', label: 'University Health Clinic', note: 'North campus · Clinic block', phone: '+256 700 000 001', icon: 'i-hospital', accent: 'teal', placeholder: true },
    { id: 'helpdesk', label: 'Student Helpdesk', note: 'Academic Registrar\'s Office', phone: '+256 700 000 002', icon: 'i-help', accent: 'amber', placeholder: true },
    { id: 'police', label: 'Police Emergency', note: 'Uganda national emergency line', phone: '999', icon: 'i-alert', accent: 'red', placeholder: false },
    { id: 'ambulance', label: 'Ambulance & Fire', note: 'Uganda national emergency line', phone: '912', icon: 'i-heart-pulse', accent: 'red', placeholder: false }
  ];

  /* ---------------------------------------------------------------- FAQ */
  var faqs = [
    {
      q: 'Where do I clear my fees?',
      a: 'Fees are cleared at the <strong>Bursar &amp; Finance Office</strong> on College Road, a short walk from the Main Gate. Bring your student ID, your bank or mobile-money payment slip and a copy of your national ID. The Bursar issues a numbered receipt the same day — keep it, because the Registrar will not process exam registration or graduation papers without it. Office hours are Monday to Friday, 8:00am to 4:00pm.'
    },
    {
      q: 'How do I register for exams?',
      a: 'Start at the <strong>Academic Registrar (Records Office)</strong> near the Main Gate. Download the exam registration form from the student portal, fill and sign it, pay the examination fee at the Bursar, then return the signed slip and receipt to the Registrar for confirmation. Registration closes seven days before the examination week, so register early — late registration attracts a penalty and can cost you a sit.'
    },
    {
      q: 'What are the library hours and rules?',
      a: 'The <strong>Main University Library</strong> opens Monday to Friday 8:00am – 10:00pm, Saturday 9:00am – 6:00pm and Sunday 2:00pm – 8:00pm; hours are extended during exam season. The rules are simple: silence in the reading rooms, no food or drinks in the stacks, bags in the lockers on entry, and a borrowing limit of three books for fourteen days, renewable online through the portal.'
    },
    {
      q: 'Who is on the Guild Council and how do I reach them?',
      a: 'The <strong>Student Guild Council</strong> sits in the Guild Office beside College Road. The Council is made up of the Guild Chairperson, Vice Chairperson, Secretary, Treasurer and the Welfare Minister, supported by faculty representatives. The office is open Monday to Friday, 8:00am – 5:00pm. You can walk in, or log a complaint in writing through the student portal — complaints lodged at the office are acknowledged in writing.'
    },
    {
      q: 'Is there Wi-Fi on campus and where do I get help?',
      a: 'Yes — campus-wide Wi-Fi covers the Library, the ICT Labs, the faculty blocks, the halls of residence and the Administration Plaza. Use your student portal credentials to sign in. For password resets, device set-up, LMS access or a lost account, visit the <strong>IT Help Desk</strong> near the Bursar on College Road (Monday to Friday, 8:00am – 6:00pm) or the ICT Labs in the West block.'
    },
    {
      q: 'How do I reach the KIU Teaching Hospital?',
      a: 'The Teaching Hospital sits at the north end of campus. From the Main Gate, walk north on Spine Avenue, turn right onto Hostel Road, then continue on Hospital Drive. Alternatively take the campus shuttle, which stops at the Teaching Hospital entrance every fifteen minutes. The out-patient department runs around the clock; the clinic and pharmacy keep daytime hours.'
    },
    {
      q: 'What documents do I need on my first day?',
      a: 'Bring your national ID or passport, the KIU admission letter, a copy of your previous academic certificates and transcripts, a birth certificate, two passport photographs, your fee receipt and your student ID. If you are a non-Ugandan international student, also bring your passport, student visa and the yellow fever vaccination certificate.'
    },
    {
      q: 'How do I get around the campus?',
      a: 'Walking is the quickest way between most buildings — the full campus takes about ten minutes end to end. The <strong>campus shuttle</strong> loops between the Main Gate, the Library Walk, Hostel Road and the Teaching Hospital every fifteen minutes from 7:00am to 9:00pm, and it is free for students. Boda taxis and cars wait at the Transport Point on Ggaba Road just outside the gate.'
    }
  ];

  /* --------------------------------------------------------- first visit */
  var welcome = {
    title: 'Welcome to the KIU Campus Navigator',
    body: 'Find any building, plan a walking route, and reach the people who can help you — all in one calm, friendly place.',
    tips: [
      { icon: 'i-search', title: 'Search anything', text: 'Type a room, department or service — results highlight on the map instantly.' },
      { icon: 'i-route', title: 'Get directions', text: 'Pick a start and a destination for step-by-step walking directions and time.' },
      { icon: 'i-bookmark', title: 'Save favourites', text: 'Bookmark the places you visit often; they stay on this device.' }
    ]
  };

  return {
    meta: meta,
    categories: categories,
    quickFilters: quickFilters,
    roads: roads,
    greens: greens,
    plazas: plazas,
    boundary: boundary,
    locations: locations,
    contacts: contacts,
    faqs: faqs,
    welcome: welcome,
    byId: function (id) {
      for (var i = 0; i < locations.length; i++) {
        if (locations[i].id === id) return locations[i];
      }
      return null;
    },
    category: function (id) {
      for (var i = 0; i < categories.length; i++) {
        if (categories[i].id === id) return categories[i];
      }
      return categories[0];
    }
  };
})();
