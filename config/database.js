require('dotenv').config();
const mongoose = require('mongoose')

const connectToDatabase =()=> {
    mongoose.connect(process.env.MONGO_URI,
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