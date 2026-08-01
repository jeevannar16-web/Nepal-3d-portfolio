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
  /** TODO: drop a .glb path here (e.g. '/models/temple.glb') to replace the procedural mesh with a Blender model */
  modelPath?: string
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
    body: `Hi, I'm ${identity.name} — a ${identity.role} based in ${identity.location}. I love building practical software and understanding how computers work under the hood.`,
    skills: ['Python', 'Django', 'SQL', 'JavaScript', 'Exploring Linux internals'],
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
    position: [-12, 0, -8],
    triggerRadius: 3,
    label: 'Temple — About',
    color: '#e07a5f',
  },
  {
    id: 'tower',
    contentKey: 'skills',
    position: [10, 0, -14],
    triggerRadius: 3,
    label: 'Tower — Skills',
    color: '#81b29a',
  },
  {
    id: 'gate',
    contentKey: 'projects',
    position: [-10, 0, 10],
    triggerRadius: 3,
    label: 'Gate — Projects',
    color: '#f2cc8f',
  },
  {
    id: 'mountain',
    contentKey: 'contact',
    position: [12, 0, 12],
    triggerRadius: 3,
    label: 'Mountain — Contact',
    color: '#3d405b',
  },
]
