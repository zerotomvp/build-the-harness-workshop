import { seed } from '../seed'

const summary = seed()
console.log(`Seeded ${summary.users} users and ${summary.groups} groups`)
