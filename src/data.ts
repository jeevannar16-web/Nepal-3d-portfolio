export interface Project {
  id: string
  title: string
  description: string
  tech: string[]
  liveUrl: string
  repoUrl: string
}

export interface ZoneContent {
  key: string
  title: string
  subtitle: string
  body: string
  skills?: string[]
  projects?: Project[]
  contact?: {
    email: string
    github: string
    leetcode: string
  }
}

export interface LandmarkConfig {
  id: string
  contentKey: string
  position: [number, number, number]
  triggerRadius: number
  label: string
  color: string
  /** .glb path for the Blender/real-asset model, e.g. '/models/temple.glb' */
  modelPath?: string
  /** Uniform scale so the asset matches the scene (car ~1.3 wide, landmarks ~5-8 tall). */
  modelScale?: number
  /** Y-axis rotation (radians) to face a sensible direction. */
  modelRotationY?: number
  /** Vertical offset so the model's base sits on the ground (some assets are centered on origin). */
  modelOffsetY?: number
}

export const identity = {
  name: 'Jeevan Neupane',
  role: 'Computer Engineering student (Grade XI)',
  location: 'Kathmandu, Nepal',
}

export const zones: ZoneContent[] = [
  {
    key: 'about',
    title: 'About Me',
    subtitle: identity.role,
    body: `Hi, I'm ${identity.name} — a ${identity.role} based in ${identity.location}. I love building practical software and understanding how computers work under the hood.

What started as curiosity about how my own computer worked became a habit of taking things apart and putting them back together better. I taught myself to code by building small, useful tools, and then graduated to real projects that people actually use online.

My sweet spot is the intersection of systems and the web — knowing what happens between a keystroke and the server, while shipping interfaces that feel effortless. I value clean, honest code, and I'm happiest when something I built quietly makes someone's day a little easier.`,
    skills: ['Python', 'Django', 'SQL', 'JavaScript', 'Exploring Linux internals'],
  },
  {
    key: 'story',
    title: 'My Story',
    subtitle: 'Beyond the resume',
    body: `I grew up in Kathmandu, surrounded by centuries-old temples and the mountains on the horizon — so I've always seen the world through layers of history and craftsmanship. That curiosity carried over to computers: I started by tinkering with my own machine, breaking it, fixing it, and finally writing code to make it do what I wanted.

These days I split my time between the classroom and the command line — learning computer engineering during the day and building real, working things at night. I believe the best way to learn is to ship: every project I publish teaches me something a textbook can't.

Right now I'm deepening my systems knowledge — Linux internals, networks, how operating systems really work — while polishing the craft of clean web apps. One day I want to build software that feels as natural as walking through the valley I grew up in.`,
    skills: ['Linux', 'Systems', 'Self-taught builder', 'Problem solving'],
  },
  {
    key: 'skills',
    title: 'Skills',
    subtitle: 'What I work with every day',
    body: 'From backend web apps to low-level system tinkering, here is the toolkit I reach for.',
    skills: ['Python', 'Django', 'SQL', 'JavaScript', 'TypeScript', 'Linux internals'],
  },
  {
    key: 'projects',
    title: 'Projects',
    subtitle: 'Things I have built and shipped',
    body: 'Real projects, live on the internet. Click through to try them.',
    projects: [
      {
        id: 'os-installation',
        title: 'OS-installation',
        description:
          'Interactive OS installation simulator — practice installing Ubuntu, Windows & more before doing it for real.',
        tech: ['TypeScript', 'React', 'Vercel'],
        liveUrl: 'https://os-installation.vercel.app',
        repoUrl: 'https://github.com/jeevannar16-web/OS-installation',
      },
      {
        id: 'ojt-ecommerce',
        title: 'Ojt-Ecommerce-Website',
        description:
          'Fitness Hub — a Django fitness platform with product listings, cart and checkout.',
        tech: ['Django', 'Python', 'CSS', 'Render'],
        liveUrl: 'https://ojt-ecommerce-website.onrender.com',
        repoUrl: 'https://github.com/jeevannar16-web/Ojt-Ecommerce-Website',
      },
    ],
  },
  {
    key: 'contact',
    title: 'Contact',
    subtitle: 'Let’s talk',
    body: 'Got a project, an internship, or just want to chat about tech? Reach out.',
    contact: {
      email: 'jeevannar16@gmail.com',
      github: 'https://github.com/jeevannar16-web',
      leetcode: 'https://leetcode.com/u/jeevannar16-web',
    },
  },
]

export const landmarks: LandmarkConfig[] = [
  {
    id: 'temple',
    contentKey: 'about',
    position: [-95, 0, -80],
    triggerRadius: 3,
    label: 'Temple — About',
    color: '#e07a5f',
    modelPath: '/models/temple.glb',
    modelScale: 0.13,
    modelRotationY: 0,
    modelOffsetY: 0,
  },
  {
    id: 'tower',
    contentKey: 'skills',
    position: [90, 0, -90],
    triggerRadius: 3,
    label: 'Tower — Skills',
    color: '#81b29a',
    modelPath: '/models/dharahara.glb',
    modelScale: 0.75,
    modelRotationY: 0,
    modelOffsetY: 0,
  },
  {
    id: 'gate',
    contentKey: 'projects',
    position: [-90, 0, 95],
    triggerRadius: 3,
    label: 'Gate — Projects',
    color: '#f2cc8f',
    modelPath: '/models/gate.glb',
    modelScale: 14,
    modelRotationY: 0,
    modelOffsetY: 3.1,
  },
  {
    id: 'mountain',
    contentKey: 'contact',
    position: [95, 0, 85],
    triggerRadius: 3,
    label: 'Mountain — Contact',
    color: '#3d405b',
    modelPath: '/models/mountain.glb',
    modelScale: 0.65,
    modelRotationY: 0,
    modelOffsetY: 0,
  },
  {
    id: 'stupa',
    contentKey: 'story',
    position: [45, 0, -5],
    triggerRadius: 3,
    label: 'Stupa — My Story',
    color: '#8ab6d6',
  },
]
