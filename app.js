const express = require('express')
const cookieParser = require('cookie-parser')
const routes = require('./routes/route')
const cors = require("cors");
const app = express()



const corsOptions = {
  origin: [
    'https://eshikshamitralms.netlify.app', 
    'https://eshikshamitra.netlify.app', 
    'https://edaksha.netlify.app',
    'http://localhost:3000',
    'http://localhost:5173',
    'https://digitalvidyasaarthi.in',
    'https://digitalvidyasaarthi.netlify.app',
    'https://superdvs.netlify.app',
    'https://dvsschool.netlify.app/',
    'https://corplyxsuperadmin.netlify.app' // Add your new frontend URL here
  ],
  credentials: true, // Include cookies and authentication headers
};

console.log('hey buddy',corsOptions)
app.use(cors(corsOptions));



app.use(cors(corsOptions));


app.use(express.json())

app.use(cookieParser())

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "All route is working fine"
  })
})

app.use('/api/v1',routes)

module.exports = app
