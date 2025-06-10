require('dotenv').config();
const mongoose = require('mongoose')

const connectToDatabase =()=> {
    mongoose.connect(process.env.MONGO_URI || process.env.DB_URI || 'mongodb://admin:digividya@147.93.106.220:27017/DigitalVidyaSaarthi?authSource=admin',
  {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }
).then((data)=>{
    console.log('MongoDB connected with server')
}).catch((err)=>{
   console.log(err)
})
}
module.exports = connectToDatabase