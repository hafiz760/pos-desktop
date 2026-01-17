import mongoose from 'mongoose'
import dotenv from 'dotenv'
dotenv.config()

const MONGODB_URI =
  process.env.MONGODB_URI ||
  'mongodb+srv://hafizhasnain:Ld6uKA5vXz83Zn4O@cluster0.dwt3iz6.mongodb.net/pos_database'

console.log(MONGODB_URI)
let isConnected = false

export async function connectToDatabase() {
  if (isConnected) {
    console.log('Already connected to MongoDB')
    return
  }

  try {
    const db = await mongoose.connect(MONGODB_URI)

    isConnected = db.connections[0].readyState === 1
    console.log('✅ Connected to MongoDB')
  } catch (error) {
    console.error('❌ MongoDB connection error:', error)
    throw error
  }
}

export async function disconnectFromDatabase() {
  if (!isConnected) return

  try {
    await mongoose.disconnect()
    isConnected = false
    console.log('Disconnected from MongoDB')
  } catch (error) {
    console.error('Error disconnecting from MongoDB:', error)
  }
}
