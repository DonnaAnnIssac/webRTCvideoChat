const express = require('express')
const app = express()
const server = require('http').createServer(app)
const io = require('socket.io')(server)
const uuid = require('uuid/v4')
app.use(express.static('./node_modules/socket.io-client'))
app.use(express.static('./public'))

server.listen(9999, () => {
  console.log('Listening on 9999')
})

let clients = {}
let rooms = {}

io.on('connection', client => {
  console.log('Connected')
  client.on('set active', name => {
    console.log('Setting ' + name + ' as active')
    clients[client.id] = {
      clientName: name,
      status: 'active'
    }
    client.emit('active', client.id, name, clients)
    client.broadcast.emit('new peer', clients)
  })
  client.on('message', (message, room, id) => {
    if (id === null) {
      client.to(room).emit('message', message, client.id)
    } else {
      client.to(id).emit('message', message, client.id)
    }
  })
  client.on('create', id => {
    console.log('Received request to create room with ' + id)
    // creating new room
    let room = uuid()
    rooms[room] = [client.id]
    client.join(room)
    client.emit('created', room, id)
  })
  client.on('init', (msg, id, room) => {
    io.sockets.connected[id].emit('invited', room, msg, client.id)
  })
  client.on('join', room => {
    rooms[room].push(client.id)
    client.join(room)
    client.emit('joined', rooms[room])
    client.to(room).emit('accepted', rooms[room])
  })
  // client.on('disconnect', room => {
  //   let index = rooms[room].indexOf(client)
  //   if (index !== -1) {
  //     client.to(room).emit('disconnected', client)
  //     rooms[room].splice(index, 1)
  //   }
  // })
})
