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

export interface Identity {
  name: string
  role: string
  location: string
}

export interface Profile {
  key: string
  name: string
  identity: Identity
  zones: ZoneContent[]
}

export interface PortfolioData {
  profiles: Profile[]
}

export interface LandmarkConfig {
  id: string
  contentKey: string
  position: [number, number, number]
  triggerRadius: number
  label: string
  color: string
  modelPath?: string
  modelScale?: number
  modelRotationY?: number
  modelOffsetY?: number
}