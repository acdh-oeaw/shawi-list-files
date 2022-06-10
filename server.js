const service = require('restana')({})
const cors = require('cors')
const compression = require('compression')
service.use(compression())
service.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT'],
  allowedHeaders: ['Content-Type'],
  maxAge: 300,
  optionsSuccessStatus: 200
}))
service.options('*', cors())

require('./list-wav-files')(service)

// start the server
service.start(process.env.PORT||3000).then((server) => {
  console.log('Listening on port ' + server.address().port); //Listening on port 3000
})
