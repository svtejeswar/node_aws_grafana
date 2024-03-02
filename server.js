const http=require("http")
const dotenv=require('dotenv')
const app=require("./app")

process.on("uncaughtException",(error)=>{
        console.log(error)
        process.exit(1)
})

dotenv.config({path:'./.env'})

let  httpServer=http.createServer(app)

const server=httpServer.listen(process.env.PORT,()=>{
        console.log(`Server Running at:${process.env.PORT}`)
})



process.on("unhandledRejection",(error)=>{
                    console.log(error)
                    server.close(()=>{
                        process.exit(1)
                    })


})