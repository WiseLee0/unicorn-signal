const WebSocket = require('ws')
const wss = new WebSocket.Server({ port: 8010 })
const code2ws = new Map()
const roomChat = new Map()
const roomVideo = new Map()
wss.on('connection', (ws, request) => {
    const code = Math.floor(Math.random() * (999999 - 100000)) + 100000
    let myName
    let rooms
    ws.sendData = (event, data = {}, name = "") => {
        ws.send(JSON.stringify({ event, data, name }))
    }
    ws.sendError = msg => {
        ws.sendData('error', { msg })
    };
    ws.on('message', message => {
        let parseMessage = {}
        try {
            parseMessage = JSON.parse(message)
        } catch (error) {
            ws.sendError('parse error')
            return
        }
        let { event, data } = parseMessage
        switch (event) {
            case 'getMyCode':
                code2ws.set(code, ws)
                ws.sendData('resMyCode', { code })
                break;
            case 'connect':
                let remoteCode = +data.remoteCode
                if (code2ws.has(remoteCode)) {
                    let remoteWS = code2ws.get(remoteCode)
                    ws.sendRemote = remoteWS.sendData
                    remoteWS.sendRemote = ws.sendData
                    ws.sendData('operate', { remoteCode, label: data.label })
                    ws.sendRemote('receive', { remoteCode: code, label: data.label })
                } else {
                    ws.sendData('notFound')
                }
                break;
            case 'forward':
                ws.sendRemote(data.event, data.data)
                break;
            case 'joinRoom':
                rooms = data.label == 'chat' ? roomChat : roomVideo
                if (rooms.has(data.name)) {
                    ws.sendData('notFound')
                    return
                }
                rooms.set(data.name, ws)
                myName = data.name
                ws.sendRemote = new Map()
                const receiveName = []
                for (const user of rooms) {
                    if (user[0] != data.name) {
                        let remoteWS = user[1]
                        receiveName.push(user[0])
                        ws.sendRemote.set(user[0], remoteWS.sendData)
                        remoteWS.sendRemote.set(myName, ws.sendData)
                    }
                }
                data.receiveName = receiveName
                data.nums = rooms.size
                ws.sendData('join-status', data)
                ws.sendRemote.forEach(send => {
                    send('join-nums', data.nums)
                })
                break
            case 'forwardRoom':
                if (data.name.length) {
                    const send = ws.sendRemote.get(data.name)
                    send(data.event, data.data, myName)
                } else {
                    ws.sendRemote.forEach(send => {
                        send(data.event, data.data, myName)
                    })
                }
                break;
            case 'leaveRoom':
                ws.sendRemote.clear()
                rooms.delete(myName)
                break;
            default:
                break;
        }
    })
    ws.on('close', () => {
        if (code2ws.has(code)) code2ws.delete(code)
        if (roomChat.has(myName)) roomChat.delete(myName)
        if (roomVideo.has(myName)) roomVideo.delete(myName)
        clearTimeout(ws._closeTimeout)
    })
    ws._closeTimeout = setTimeout(() => {
        ws.terminate()
    }, 10 * 60 * 1000);
})
