import "dotenv/config"
import express from "express"
import mongoose from "mongoose"
import helmet from "helmet"
import cors from "cors"
import { ZodError } from "zod"
import authRouter from "./routes/Auth.js"
import notesRouter from "./routes/Note.js"

const app=express()

app.use(helmet())

app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || "https://localhost:5173",
    credentials:true
}))

app.use(express.json({ limit: "10kb" }))

mongoose.connect(process.env.MONGO_URI)
    .then(()=> console.log("MongoDB Connected"))
    .catch(err=>{
        console.log("MongoDB connection error :", err)
        process.exit(1)
    })

app.use("/api/auth", authRouter)
app.use("/api/notes",notesRouter)

app.get("/health", (req, res)=>{
    res.json({ status: "ok", db:mongoose.connection.readyState === 1 ? "connected" : "down"})
})

app.use((req, res)=>{
    res.status(404).json({ success:false, error: "Route not found"})
})

app.use((err, req, res, next)=>{
    console.log(err)

    if( err instanceof ZodError){
        return res.status(400).json({
            success: false,
            error: "Validation failed",
            details: err.issues.map(i=> ({ field: i.path.join("."), message: i.message }))
        })
    }

    if (err.code === 11000){
        const field = Object.keys(err.keyValue)[0]
        return res.status(409).json({
            success: false,
            error: `${field} already exists`
        })
    }

    const status = err.statusCode || 500
    const message = err.statusCode ? err.message : "Internal server error"
    res.status(status).json({ success: false, error:message })
})

const PORT = process.env.PORT || 3000

app.listen(PORT, ()=>{
    console.log(`Server running on http://localhost:${PORT}`)
})

process.on("SIGTERM", ()=> {
    console.log("SIGTERM received. Closing server...")
    mongoose.connection.close(false).then(()=>{
        console.log("MongoDB disconnected. Exiting.")
        process.exit(0)
    })
})