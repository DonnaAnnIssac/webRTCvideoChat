import { handshake } from './handshake.js'
let socket = io.connect()
let listOfClients = document.querySelector('#clientsList')
let sendData = document.getElementById('msg')
let sendBtn = document.getElementById('sendMsg')
let incomingMsg = document.getElementById('incomingMsg')
let callBtn = document.getElementById('callButton')
let hangBtn = document.getElementById('hangupButton')
let localVideo = document.querySelector('#localVideo')
let remoteFeeds = document.querySelector('#remoteFeeds')
let appData = {}
let create = false
let allClients = {}
let grpMembers = []
let updatedRoom = null
sendBtn.disabled = true
callBtn.disabled = true
hangBtn.disabled = true

function sendMsgToRoom () {
  if (sendData.value !== '') {
    acceptIncomingMsg(sendData.value, 'fromMe', appData.myName, handshake.currRoom)
    socket.emit('group chat', sendData.value, grpMembers, handshake.currRoom, appData.myId)
    sendData.value = ''
  }
}

sendData.addEventListener('keypress', (e) => {
  if (e.keyCode === 13) {
    sendMsgToRoom()
  }
})

sendBtn.addEventListener('click', sendMsgToRoom)

document.querySelector('#logout').addEventListener('click', () => {
  socket.disconnect()
  window.location = '/'
})

function displayNotification (notification) {
  acceptIncomingMsg(notification, 'general', null, handshake.currRoom)
}
socket.on('disconnected', id => {
  let disconnectedNode = document.getElementById(allClients[id])
  listOfClients.removeChild(disconnectedNode)
  if (document.querySelector('#chatHead').innerText.indexOf(allClients[id]) !== -1) {
    document.querySelector('#chatHead').innerText = document.querySelector('#chatHead').innerText.replace(allClients[id], '')
    if (document.querySelector('#chatHead').innerText === '') {
      while (incomingMsg.firstChild) {
        incomingMsg.removeChild(incomingMsg.firstChild)
        sendBtn.disabled = true
        callBtn.disabled = true
      }
    } else {
      displayNotification(allClients[id] + ' left')
    }
  }
  delete allClients[id]
})

function createRoom (members) {
  members.push(appData.myId)
  socket.emit('create', members)
}

function toggleClientList () {
  listOfClients.style.display = (listOfClients.style.display === 'block') ? 'none' : 'block'
}

function createGroup () {
  if (!create) {
    create = true
    grpMembers = []
    document.querySelector('#newRoom').innerText = 'Create'
    toggleClientList()
  } else {
    create = false
    document.querySelector('#newRoom').innerText = 'New Room'
    toggleClientList()
    if (grpMembers.length > 0) {
      createRoom(grpMembers)
    }
  }
}

document.querySelector('#newRoom').addEventListener('click', createGroup)

function updateCurrOrGroup (id) {
  grpMembers.push(id)
}

function updateClientList (clientsList) {
  for (let client in clientsList) {
    if (!allClients.hasOwnProperty(client) && client !== appData.myId) {
      let clientDiv = document.createElement('div')
      clientDiv.innerText = clientsList[client]
      clientDiv.id = clientsList[client]
      clientDiv.addEventListener('click', () => updateCurrOrGroup(client))
      listOfClients.appendChild(clientDiv)
      listOfClients.style.display = 'none'
      allClients[client] = clientsList[client]
    }
  }
  console.log(allClients)
}

socket.on('new peer', clients => {
  updateClientList(clients)
})

socket.on('clients', clients => {
  updateClientList(clients)
})

function processUser (user) {
  appData.myId = user.id
  appData.myName = user.name
  document.getElementById('welcome').innerText = user.name
  document.querySelector('img').src = user.picture
  document.querySelector('img').height = '60'
  document.querySelector('img').weight = '60'
  socket.emit('active', appData.myId, appData.myName)
}

window.onload = () => {
  let xhr = new XMLHttpRequest()
  xhr.open('GET', '/api/me')
  xhr.onreadystatechange = function () {
    if (xhr.readyState === XMLHttpRequest.DONE && xhr.status === 200) {
      processUser(JSON.parse(xhr.responseText))
    }
  }
  xhr.send()
}

socket.on('init', (room, members) => {
  handshake.currRoom = room
  grpMembers = members
  socket.emit('join', room)
})

function updateChatHead (clients) {
  let str = clients.map(id => {
    if (id !== appData.myId) return allClients[id]
  }).join(' ')
  document.querySelector('#chatHead').innerText = str
}

function clearChatWindow (room) {
  if (handshake.currRoom !== room) {
    while (incomingMsg.firstChild) {
      incomingMsg.removeChild(incomingMsg.firstChild)
    }
  }
}

socket.on('created', (room, members) => {
  updateChatHead(members)
  clearChatWindow(room)
  handshake.currRoom = room
  members.forEach(member => {
    if (member !== appData.myId) socket.emit('init', room, member)
  })
  sendBtn.disabled = false
  callBtn.disabled = false
})

function updateScroll () {
  incomingMsg.scrollTop = incomingMsg.scrollHeight
}
function acceptIncomingMsg (message, clsName, sender, room) {
  handshake.currRoom = room
  let msg = document.createElement('div')
  msg.innerText = message
  if (sender && sender !== appData.myName) {
    let sentBy = document.createElement('div')
    sentBy.innerText = sender
    let grpMsg = document.createElement('div')
    grpMsg.appendChild(sentBy)
    grpMsg.appendChild(msg)
    grpMsg.className = clsName
    grpMsg.style.backgroundColor = 'white'
    incomingMsg.appendChild(grpMsg)
  } else {
    msg.className = clsName
    msg.style.backgroundColor = 'white'
    incomingMsg.appendChild(msg)
  }
  updateScroll()
}

function chatTextHandler (from, clients, msg, room) {
  sendBtn.disabled = false
  callBtn.disabled = false
  handshake.currClient = from
  if (updatedRoom !== room) {
    updateChatHead(clients)
    clearChatWindow(room)
    updatedRoom = room
  }
  acceptIncomingMsg(msg, 'toMe', allClients[from], room)
}

socket.on('group chat text', (clients, msg, from, room) => {
  grpMembers = clients
  if (from !== appData.myId) {
    chatTextHandler(from, clients, msg, room)
  }
})

document.getElementById('accept').addEventListener('click', () => {
  callBtn.disabled = true
  sendBtn.disabled = false
  hangBtn.disabled = false
  document.getElementById('callInvite').style.display = 'none'
  handshake.onCall = true
  if (grpMembers.map(m => {
    if (m !== appData.myId) return allClients[m]
  }).join(' ').trim() !== document.querySelector('#chatHead').innerText.trim()) {
    updateChatHead(grpMembers)
    clearChatWindow()
  }
  sendMessage('accept call', handshake.currClient)
})

document.getElementById('decline').addEventListener('click', () => {
  document.getElementById('callInvite').style.display = 'none'
  callBtn.disabled = false
  sendBtn.disabled = false
  updateChatHead(grpMembers)
  sendMessage('decline call', handshake.currClient)
})

callBtn.addEventListener('click', () => {
  callBtn.disabled = true
  handshake.isInitiator = true
  handshake.onCall = true
  handshake.currMembers.push(appData.myId)
  sendMessage('call invitation')
})

hangBtn.addEventListener('click', () => {
  handshake.currMembers = []
  stop()
  sendMessage('bye')
})

function sendMessage (message, id) {
  socket.emit('message', message, handshake.currRoom, id)
}

function stop () {
  hangBtn.disabled = true
  handshake.onCall = false
  callBtn.disabled = false
  for (let id in handshake.pcDictionary) {
    removePeer(id)
  }
  if (localVideo.srcObject) {
    localVideo.srcObject = null
    handshake.localStream.getTracks().forEach(track => track.stop())
    handshake.localStream = null
    document.querySelector('.videoStreams').style.display = 'none'
    incomingMsg.style.flex = '10'
  } else {
    callBtn.disabled = true
    sendBtn.disabled = true
  }
}

function removePeer (id) {
  let disconnectedPeer = document.getElementById(id)
  if (disconnectedPeer) {
    disconnectedPeer.srcObject = null
    remoteFeeds.removeChild(disconnectedPeer)
  }
  handshake.remoteStream[id].getTracks().forEach(track => track.stop())
  delete handshake.remoteStream[id]
  handshake.pcDictionary[id].close()
  delete handshake.pcDictionary[id]
  handshake.peersInCurrRoom.splice(handshake.peersInCurrRoom.indexOf(id), 1)
}

function onLocalStream (localStream, id) {
  document.querySelector('.videoStreams').style.display = 'flex'
  localVideo.srcObject = localStream
  sendMessage('got user media', id)
}

function onRemoteStream (remoteStream, id) {
  let remoteVideo = document.createElement('video')
  remoteVideo.setAttribute('autoplay', true)
  remoteVideo.setAttribute('id', id)
  remoteVideo.srcObject = remoteStream
  remoteFeeds.appendChild(remoteVideo)
  incomingMsg.style.flex = '4'
  if (remoteFeeds.childElementCount === 1) {
    remoteVideo.style.flex = '1'
  } else {
    let children = remoteFeeds.childNodes
    for (let i = 0; i < children.length; i++) {
      children[i].style.flex = '1'
    }
  }
}

function handleRemoteHangup (id) {
  let index = handshake.currMembers.indexOf(id)
  handshake.currMembers.splice(index, 1)
  if (handshake.peersInCurrRoom.length > 1) {
    removePeer(id)
  } else {
    stop()
  }
}

function onInvite (id) {
  handshake.isInitiator = false
  callBtn.disabled = true
  handshake.currClient = id
  document.getElementById('callInvite').style.display = 'block'
  document.getElementById('caller').innerText = allClients[id] + ' is calling'
}

socket.on('current network', (currMembers, id) => {
  console.log('Received network members')
  console.log(currMembers)
  handshake.status = 'master'
  handshake.queue = currMembers
  processQueue(id)
})

function onDone () {
  if (handshake.isInitiator) {
    if (handshake.queue.length === 0) {
      handshake.isProcessing = false
    } else {
      sendMessage('got user media', handshake.queue.shift())
    }
  }
}

function processQueue (id) {
  console.log('Queue length: ')
  console.log(handshake.queue.length)
  if (handshake.queue.length > 0) {
    console.log('Starting handshake with ' + handshake.queue[0])
    handshake.currMembers.push(handshake.queue[0])
    handshake.start(handshake.queue.shift(), null, sendMessage, onRemoteStream)
  } else {
    console.log('Connected to all peers. Part of network now.')
    handshake.currMembers.push(appData.myId)
    handshake.status = 'slave'
    sendMessage('done')
  }
}

function onAccept (id) {
  hangBtn.disabled = false
  if (handshake.isProcessing) {
    handshake.queue.push(id)
  } else {
    handshake.isProcessing = true
    if (handshake.localStream === null) {
      console.log('Initiator getting local stream')
      handshake.getLocalStream(onLocalStream, id)
    } else {
      sendMessage('got user media', id)
    }
  }
}

function onDecline (id) {
  hangBtn.disabled = true
  callBtn.disabled = false
  displayNotification('Call declined by ' + allClients[id])
}

function sendCurrPeers (id) {
  console.log('Notifying about network')
  console.log('to ' + allClients[id])
  handshake.status = 'slave'
  socket.emit('current network', id, handshake.currMembers)
}

socket.on('message', (message, id) => {
  if (message === 'got user media' && handshake.onCall) {
    if (handshake.localStream === null) {
      handshake.getLocalStream(onLocalStream, id)
    } else {
      sendCurrPeers(id)
    }
  } else if (message.type === 'offer' && handshake.peersInCurrRoom.indexOf(id) === -1) {
    console.log('Getting offer')
    console.log(message)
    handshake.currMembers.push(id)
    handshake.onOffer(id, message, sendMessage, onRemoteStream)
  } else if (message.type === 'answer') {
    console.log('Getting answer')
    handshake.onAnswer(id, message, processQueue)
  } else if (message.type === 'candidate') {
    handshake.onCandidate(id, message)
  } else if (message === 'bye') {
    handleRemoteHangup(id)
  } else if (message === 'call invitation') {
    onInvite(id)
  } else if (message === 'accept call' && handshake.onCall) {
    onAccept(id)
  } else if (message === 'decline call') {
    onDecline(id)
  } else if (message === 'done') {
    onDone()
  }
})

window.onbeforeunload = function () {
  sendMessage('bye')
}
