// Everything the site says lives in this file. Edit the words here; the pages rebuild themselves.
// Block types a room understands: p, h, list, steps, facts, timeline, tags, links, note, widget.

export const SITE = {
  name: 'Krishil Ghelani',
  short: 'Kris',
  alias: 'Kris Thakkar',
  domain: 'krishilghelani.com',
  thesis: 'I build tools that turn India’s financial data into information.',
  credits: ['Founder and CEO, Obelisk', 'Founder, Veripres', 'IIM Bangalore', 'IIT Jodhpur'],
  location: 'Ahmedabad, India',

  contact: {
    email: 'krishil@obeliskcorp.com',
    linkedin: 'https://www.linkedin.com/in/krishil-ghelani-21a119281',
    // Optional. If you add a form endpoint (Formspree, Web3Forms, your own API), requests are POSTed there as JSON.
    // Left empty, the forms open a pre-written email instead, which needs no backend at all.
    formEndpoint: '',
  },
  links: { obelisk: 'https://obeliskcorp.com', veripres: 'https://veripres.com' },

  // The appointment form. Times are offered in India Standard Time and shown to visitors in their own.
  booking: {
    daysAhead: 14,
    weekdays: [1, 2, 3, 4, 5, 6],                       // 0 = Sunday
    slots: ['10:30', '12:00', '15:00', '17:30', '21:00'],
    types: [
      { id: 'intro', label: 'Introduction', mins: 20 },
      { id: 'investor', label: 'Investor conversation', mins: 30 },
      { id: 'collab', label: 'Collaboration', mins: 30 },
      { id: 'press', label: 'Press or speaking', mins: 30 },
    ],
  },

  // Add your films here and a Reel section appears in the Cinematography room.
  // { title: 'After-movie, 2024', url: 'https://youtu.be/...', note: 'Director, camera, edit' }
  reel: [],

  bio: 'I’m Krishil Ghelani. Most people call me Kris. I am the founder and CEO of Obelisk, where I am building SAGE, a research terminal for India’s markets, and the founder of Veripres, a prescription network that leaves the patient in charge of their own record. I am reading two undergraduate degrees at once, at IIT Jodhpur and IIM Bangalore. Away from the desk I lift, play chess, practise card magic and shoot film. I live in Ahmedabad.',

  // The film: one entry per camera stop, in order. The first is the title card.
  scenes: [
    { id: 'title', hint: 'Scroll. Eight locations, one city.' },
    { id: 'obelisk', place: 'Financial District', coords: '40.7075° N  74.0113° W', title: 'Obelisk',
      line: 'The company I founded to build SAGE, a research terminal for India’s markets.', cta: 'Enter Obelisk' },
    { id: 'veripres', place: 'First Avenue', coords: '40.7421° N  73.9740° W', title: 'Veripres',
      line: 'One health record that travels with the patient, opened only on their say-so.', cta: 'Enter Veripres' },
    { id: 'education', place: 'Morningside Heights', coords: '40.8075° N  73.9626° W', title: 'Two degrees',
      line: 'IIT Jodhpur and IIM Bangalore, read side by side.', cta: 'See the record' },
    { id: 'training', place: 'The Reservoir, Central Park', coords: '40.7858° N  73.9626° W', title: 'Training',
      line: 'Powerlifting. A 200 kg deadlift, and a runner-up finish in competition.', cta: 'Load the bar' },
    { id: 'sleight', place: 'Broadway', coords: '40.7580° N  73.9855° W', title: 'Sleight of hand',
      line: 'Card magic. Think of a card, and watch what happens to it.', cta: 'Pick a card' },
    { id: 'chess', place: 'Washington Square', coords: '40.7308° N  73.9973° W', title: 'Chess',
      line: 'Rated around 1800. The board is where I practise deciding.', cta: 'Sit down at the board' },
    { id: 'film', place: 'Brooklyn Bridge', coords: '40.7061° N  73.9969° W', title: 'Cinematography',
      line: 'I shoot. Take the camera: change the lens, the hour and the grade.', cta: 'Open the viewfinder' },
    { id: 'contact', place: 'Upper Bay', coords: '40.6892° N  74.0445° W', title: 'Let’s talk',
      line: 'Investors, collaborators, press, students, or a game of chess.', cta: 'Book a conversation' },
  ],

  rooms: {
    obelisk: {
      kicker: 'Founder and Chief Executive Officer · 2026 to present',
      title: 'Obelisk',
      lede: 'I build tools that turn India’s financial data into information.',
      blocks: [
        { type: 'p', text: 'Obelisk Techno Solution Private Limited is a technology company in Ahmedabad. I founded it in 2026 and lead product, technology and overall direction.' },
        { type: 'h', text: 'SAGE' },
        { type: 'p', text: 'Our first product is SAGE: a keyboard-first research terminal for NSE, BSE and MCX. Its intelligence layers show how companies and people are connected, and where.' },
        { type: 'p', text: 'SAGE is in private development. It is research only, by design. It shows and it describes. It does not advise, rate, or place a trade.' },
        { type: 'widget', name: 'graph', caption: 'A glimpse, with the labels left off. SAGE is in build.' },
        { type: 'h', text: 'How I build' },
        { type: 'list', items: [
          'No invented numbers. An honest empty state beats a convincing demo.',
          'Every figure carries its source and its age.',
          'Describe, never evaluate. The reader makes the call.',
          'Density with hierarchy. Colour is spent only on meaning.',
        ] },
        { type: 'note', text: 'I came to finance through computer science, not the other way round. SAGE is an engineering problem before it is a markets problem.' },
        { type: 'facts', rows: [
          ['Company', 'Obelisk Techno Solution Private Limited'],
          ['Role', 'Founder and Chief Executive Officer'],
          ['Based', 'Ahmedabad, India · 23.03° N 72.58° E'],
          ['Product', 'SAGE, in build'],
        ] },
        { type: 'links', items: [{ label: 'obeliskcorp.com', url: 'https://obeliskcorp.com' }] },
      ],
    },

    veripres: {
      kicker: 'Founder',
      title: 'Veripres',
      lede: 'Your health record, on your phone. Nobody opens it without you.',
      blocks: [
        { type: 'p', text: 'Veripres is a prescription network for India. It puts doctors, pharmacies and patients on one shared record, so that visits, prescriptions and reports live in one place instead of a bag of files.' },
        { type: 'p', text: 'The whole system is arranged around one rule. Nobody searches for a patient. The patient unlocks their own record, for a limited time, and every look is written to a log they can read the same day.' },
        { type: 'widget', name: 'vcard', caption: 'An illustration of the patient card. The codes shown here are not real.' },
        { type: 'h', text: 'How a record opens' },
        { type: 'steps', items: [
          'The patient shows a card on their phone. Its code changes every 30 seconds and works once.',
          'Or the clinic enters the patient’s Veripres ID, and nothing opens until the patient taps Approve.',
          'The doctor signs an e-prescription. Any pharmacy can check that it is genuine and unchanged, without seeing whose it is.',
        ] },
        { type: 'facts', rows: [
          ['Role', 'Founder'],
          ['Status', 'Pilot'],
          ['Patients', 'Free, always'],
          ['Doctors and pharmacies', 'By invitation during the pilot'],
        ] },
        { type: 'links', items: [{ label: 'veripres.com', url: 'https://veripres.com' }] },
      ],
    },

    education: {
      kicker: 'Education and record',
      title: 'Two degrees, side by side',
      lede: 'I am reading two undergraduate degrees at once, at IIT Jodhpur and IIM Bangalore, while running a company.',
      blocks: [
        { type: 'timeline', items: [
          { when: '2026 to 2030, expected', title: 'Indian Institute of Technology Jodhpur', sub: 'B.S. in Management and Technology',
            text: 'Economics, computing, statistics and machine learning in the early years. Strategy, big data and financial technology later.' },
          { when: '2026 to 2029, expected', title: 'Indian Institute of Management Bangalore', sub: 'BBA in Digital Business and Entrepreneurship',
            text: 'Digital business and venture building.' },
          { when: 'Graduated June 2025', title: 'Udgam School for Children, Ahmedabad', sub: 'International Baccalaureate Career-related Programme',
            text: 'Higher Level: Mathematics (Applications and Interpretation), Computer Science, Physics. Standard Level: Business Management. Career-related study: Diploma in Business Administration.' },
        ] },
        { type: 'h', text: 'Before Obelisk' },
        { type: 'timeline', items: [
          { when: '2023 to 2024', title: 'Paramount Conferences', sub: 'Founder',
            text: 'A student-run conference organisation. Led a team of more than 80 and hosted conferences with the Youth Debating Society and Apple Global School, in partnership with Gujarat National Law University’s Centre for Women and Child Rights. Launched Super 15, a free-access programme bringing underprivileged children into structured educational opportunities.' },
          { when: '2021 to 2022', title: 'Axisray', sub: 'Software Development Intern',
            text: 'Built web applications in Python (Flask, Django) with SQL databases, processed large datasets with NumPy and pandas, and built a custom voice assistant on AWS.' },
        ] },
        { type: 'h', text: 'Leadership' },
        { type: 'list', items: [
          'President and Convener, Student Activities Council, Udgam School, 2024 to 2025. Established the school’s first council and launched five clubs.',
          'Head of On-Ground Coordination, Kitaab Aur Kalam Foundation, Jammu and Kashmir, 2023. Three hundred volunteer hours on the Maidan community-education project.',
          'Organising Committee, Legge Rhythms International MUN, 2023 to 2024. Recruited and managed more than 800 delegates across two editions, and produced the official after-movies.',
          'Leader, Atal Tinkering Lab Club, Shanti Asiatic School, 2022. Guided more than 15 students through an award-winning Python deep-learning project.',
          'Delegate, Global Fintech Fest, Mumbai, 2026.',
        ] },
        { type: 'h', text: 'Tools' },
        { type: 'tags', items: ['Python', 'Java', 'SQL', 'Flask', 'Django', 'NumPy', 'pandas', 'Machine learning', 'Deep learning', 'Kotlin', 'AWS'] },
        { type: 'facts', rows: [['Languages', 'English (IELTS 7.5, C1), Gujarati, Hindi']] },
      ],
    },

    training: {
      kicker: 'Powerlifting',
      title: 'Training',
      lede: 'Two hundred kilograms, from the floor.',
      blocks: [
        { type: 'widget', name: 'barbell', caption: 'A 20 kg bar, and 25 + 25 + 25 + 10 + 5 on each side.' },
        { type: 'p', text: 'I lift. My best deadlift is 200 kg, and I have finished runner-up in competition.' },
        { type: 'p', text: 'The bar is honest in a way most things are not. It weighs what it weighs, and the only way to move more of it is to come back tomorrow.' },
        { type: 'facts', rows: [['Discipline', 'Powerlifting'], ['Deadlift', '200 kg'], ['Competition', 'Runner-up']] },
      ],
    },

    sleight: {
      kicker: 'Card magic',
      title: 'Sleight of hand',
      lede: 'Six cards. Think of one. Don’t touch it.',
      blocks: [
        { type: 'widget', name: 'cards' },
        { type: 'p', text: 'I practise card magic. It is a study in attention: people see what they are looking for, and miss what they are not.' },
      ],
    },

    chess: {
      kicker: 'Chess',
      title: 'Chess',
      lede: 'Rated around 1800 on chess.com.',
      blocks: [
        { type: 'widget', name: 'chess', caption: 'Paris, 1858. Paul Morphy, White, against the Duke of Brunswick and Count Isouard in consultation, played in a box at the opera. Seventeen moves, and every one of them develops a piece or wins time.' },
        { type: 'p', text: 'Chess is where I practise deciding: calculate what you can, weigh what you cannot, commit, and own the position you get.' },
      ],
    },

    film: {
      kicker: 'Cinematography',
      title: 'Behind the camera',
      lede: 'I shoot and I edit. Take the camera for a minute.',
      blocks: [
        { type: 'widget', name: 'viewfinder' },
        { type: 'p', text: 'I produced the official after-movies for two editions of Legge Rhythms International MUN, and I shoot cinematic content for the things I build.' },
        { type: 'widget', name: 'reel' },
        { type: 'p', text: 'Nothing on this site is video. Every frame is drawn live in your browser: {boxes} buildings and {lights} lights, at blue hour, at night and at first light.' },
      ],
    },

    contact: {
      kicker: 'Contact',
      title: 'Let’s talk',
      lede: 'Investors, collaborators, press, students, or a game of chess.',
      blocks: [
        { type: 'widget', name: 'booking' },
        { type: 'h', text: 'Or just write' },
        { type: 'widget', name: 'write' },
        { type: 'facts', rows: [['Based', 'Ahmedabad, India'], ['Time zone', 'India Standard Time, UTC+5:30']] },
      ],
    },
  },
};
