import jwt from "jsonwebtoken" 

export function authenticate(req, res, next){
    const authHeader=req.headers.authorization
    
    if(!authHeader||!authHeader.startsWith("Bearer")){
        return res.status(401).json({success: false, error: "Access token required"})
    }

    const token=authHeader.slice(7)

    try{
        const decoded=jwt.verify(token,process.env.JWT_SECRET)
        req.userId=decoded.userId
        next()
    }
    catch(err){
        return res.status(403).json({success: false, error:"Invalid or expired token"})
    }
} 
