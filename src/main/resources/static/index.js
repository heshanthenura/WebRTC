const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");
const localIdInp = document.getElementById("localId");
const connectBtn = document.getElementById("connectBtn");
const remoteIdInp = document.getElementById("remoteId");
const callBtn = document.getElementById("callBtn");
const testConnection = document.getElementById("testConnection");
let localStream;
let remoteStream;
let localPeer;
let remoteID;
let localID;
let stompClient;


// ICE Server Configurations
const iceServers = {
    iceServer: {
        urls: "stun:stun.l.google.com:19302"
    }
}

localPeer = new RTCPeerConnection(iceServers)


navigator.mediaDevices.getUserMedia({video: true, audio: true})
    .then(stream => {
        localStream = stream

        // console.log(stream.getTracks()[0])
        // console.log(stream.getTracks()[1])
        // console.log(localStream.getTracks()[0])
        // console.log(localStream.getTracks()[1])

        localVideo.srcObject = stream;
        // access granted, stream is the webcam stream
    })
    .catch(error => {
        // access denied or error occurred
        console.log(error)
    });


connectBtn.onclick = () => {
    // Connect to Websocket Server
    var socket = new SockJS('/websocket', {debug: false});
    stompClient = Stomp.over(socket);
    localID = localIdInp.value
    console.log("My ID: " + localID)
    stompClient.connect({}, frame => {

        console.log(frame)

        // Subscribe to testing URL not very important
        stompClient.subscribe('/topic/testServer', function (test) {
            console.log('Received: ' + test.body);
        });

        stompClient.subscribe('/user/' + localIdInp.value + "/topic/call", (call) => {
            console.log("Call From: " + call.body)
            remoteID = call.body;
            console.log("Remote ID: " + call.body)

            localPeer.ontrack = (event) => {
                // Setting Remote stream in remote video element
                remoteVideo.srcObject = event.streams[0]
            }


            localPeer.onicecandidate = (event) => {
                if (event.candidate) {
                    var candidate = {
                        type: "candidate",
                        lable: event.candidate.sdpMLineIndex,
                        id: event.candidate.candidate,
                    }
                    console.log("Sending Candidate")
                    console.log(candidate)
                    stompClient.send("/app/candidate", {}, JSON.stringify({
                        "toUser": call.body,
                        "fromUser": localID,
                        "candidate": candidate
                    }))
                }
            }

            // Adding Audio and Video Local Peer
            localStream.getTracks().forEach(track => {
                localPeer.addTrack(track, localStream);
            });

            localPeer.createOffer().then(description => {
                localPeer.setLocalDescription(description);
                console.log("Setting Description" + description);
                stompClient.send("/app/offer", {}, JSON.stringify({
                    "toUser": call.body,
                    "fromUser": localID,
                    "offer": description
                }))
            })
        });

        stompClient.subscribe('/user/' + localIdInp.value + "/topic/offer", (offer) => {
            console.log("Offer came")
            var o = JSON.parse(offer.body)["offer"]
            console.log(offer.body)
            console.log(new RTCSessionDescription(o))
            console.log(typeof (new RTCSessionDescription(o)))

            localPeer.ontrack = (event) => {
                remoteVideo.srcObject = event.streams[0]
            }
            localPeer.onicecandidate = (event) => {
                if (event.candidate) {
                    var candidate = {
                        type: "candidate",
                        lable: event.candidate.sdpMLineIndex,
                        id: event.candidate.candidate,
                    }
                    console.log("Sending Candidate")
                    console.log(candidate)
                    stompClient.send("/app/candidate", {}, JSON.stringify({
                        "toUser": remoteID,
                        "fromUser": localID,
                        "candidate": candidate
                    }))
                }
            }

            // Adding Audio and Video Local Peer
            localStream.getTracks().forEach(track => {
                localPeer.addTrack(track, localStream);
            });

            localPeer.setRemoteDescription(new RTCSessionDescription(o))
            localPeer.createAnswer().then(description => {
                localPeer.setLocalDescription(description)
                console.log("Setting Local Description")
                console.log(description)
                stompClient.send("/app/answer", {}, JSON.stringify({
                    "toUser": remoteID,
                    "fromUser": localID,
                    "answer": description
                }));

            })
        });

        stompClient.subscribe('/user/' + localIdInp.value + "/topic/answer", (answer) => {
            console.log("Answer Came")
            var o = JSON.parse(answer.body)["answer"]
            console.log(o)
            localPeer.setRemoteDescription(new RTCSessionDescription(o))

        });

        stompClient.subscribe('/user/' + localIdInp.value + "/topic/candidate", (answer) => {
            console.log("Candidate Came")
            var o = JSON.parse(answer.body)["candidate"]
            console.log(o)
            console.log(o["lable"])
            console.log(o["id"])
            var iceCandidate = new RTCIceCandidate({
                sdpMLineIndex: o["lable"],
                candidate: o["id"],
            })
            localPeer.addIceCandidate(iceCandidate)
        });


        stompClient.send("/app/addUser", {}, localIdInp.value)

    })

}

callBtn.onclick = () => {
    remoteID = remoteIdInp.value
    stompClient.send("/app/call", {}, JSON.stringify({"callTo": remoteIdInp.value, "callFrom": localIdInp.value}))
}

testConnection.onclick = () => {
    stompClient.send("/app/testServer", {}, "Test Server")
}