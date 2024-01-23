/*
 *  Copyright (c) 2021 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

'use strict';

const startButton = document.getElementById('startButton');
const hangupButton = document.getElementById('hangupButton');
const addVideoButton = document.getElementById('addVideoButton');
hangupButton.disabled = true;
const videoSourceSelect = document.getElementById('videoSourceSelect');

const remoteVideoContainer = document.getElementById('remoteVideoContainer');
const localVideoContainer = document.getElementById('localVideoContainer');


let remoteSession = {
  pc: null,
  views: {},
};
let localStreams = [];
let localVideos = [];

const socket = io("https://3.125.45.73:3001"); // Assuming you have imported the socket.io library

socket.on('message', (message) => {
  if (!localStreams.length) {
    console.log('not ready yet');
    return;
  }
  switch (message.type) {
    case 'offer':
      handleOffer(message);
      break;
    case 'answer':
      handleAnswer(message);
      break;
    case 'candidate':
      handleCandidate(message);
      break;
    case 'ready':
      // A second tab joined. This tab will initiate a call unless in a call already.
      if (remoteSession.pc) {
        console.log('already in call, ignoring');
        return;
      }
      makeCall();
      break;
    case 'bye':
      if (remoteSession.pc) {
        hangup();
      }
      break;
    default:
      console.log('unhandled', message);
      break;
  }
});

function sendMessage(message) {
  socket.emit('message', message);
}

startButton.onclick = async () => {

  startButton.disabled = true;
  hangupButton.disabled = false;

  sendMessage({ type: 'ready' });
};

hangupButton.onclick = async () => {
  hangup();
  sendMessage({ type: 'bye' });
};

addVideoButton.onclick = async () => {
  const deviceId = videoSourceSelect.value;
  if (!deviceId) {
    console.error('no device selected');
    return;
  }

  const localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { deviceId: deviceId } });
  const video = document.createElement('video');
  video.srcObject = localStream;
  video.autoplay = true;
  video.playsinline = true;
  video.controls = true;
  video.muted = true;
  localStreams.push(localStream);
  localVideos.push(video);
  renderLocalVideos();
  if (remoteSession.pc) {
    localStream.getTracks().forEach(track => remoteSession.pc.addTrack(track, localStream));
    renegotiate();
  }
}

async function hangup() {
  if (remoteSession.pc) {
    remoteSession.pc.close();
    remoteSession.pc = null;
    remoteVideoContainer.innerHTML = '';
    remoteSession.views = {};
  }
  localStreams.forEach(stream => stream.getTracks().forEach(track => track.stop()));
  localStreams = [];
  localVideos = [];
  localVideoContainer.innerHTML = '';
  startButton.disabled = false;
  hangupButton.disabled = true;
  renderVideoSources().then(() => {
    addVideoButton.click();
  })
};

async function createPeerConnection() {
  remoteSession.pc = new RTCPeerConnection();
  remoteSession.pc.onicecandidate = e => {
    const message = {
      type: 'candidate',
      candidate: null,
    };
    if (e.candidate) {
      message.candidate = e.candidate.candidate;
      message.sdpMid = e.candidate.sdpMid;
      message.sdpMLineIndex = e.candidate.sdpMLineIndex;
    }
    sendMessage(message);
  };
  remoteSession.pc.ontrack = e => {
    if (e.streams && Array.isArray(e.streams) && e.streams.length > 0) {
      e.streams.forEach(stream => {
        if (remoteSession.views[stream.id]) {
          remoteSession.views[stream.id].srcObject = stream;
        } else {
          const video = document.createElement('video');
          video.srcObject = stream;
          video.autoplay = true;
          video.playsinline = true;
          video.controls = true;
          document.body.appendChild(video);
          remoteSession.views[stream.id] = video;
        }
        renderRemoteVideos();
      });
    }
  }
  localStreams = await Promise.all(localStreams);
  localStreams.forEach(stream => stream.getTracks().forEach(track => remoteSession.pc.addTrack(track, stream)));
}

async function renderRemoteVideos() {
  const streamIds = Object.keys(remoteSession.views);
  for (let i = 0; i < streamIds.length; i++) {
    const view = remoteSession.views[streamIds[i]];
    remoteVideoContainer.appendChild(view);
  }
}

async function renderLocalVideos() {
  for (let i = 0; i < localVideos.length; i++) {
    const video = localVideos[i];
    localVideoContainer.appendChild(video);
  }
}

async function makeCall() {
  await createPeerConnection();
  await sendOffer();
}

async function sendOffer() {
  const offer = await remoteSession.pc.createOffer();
  sendMessage({ type: 'offer', sdp: offer.sdp });
  await remoteSession.pc.setLocalDescription(offer);
}

async function handleOffer(offer) {
  if (!remoteSession.pc) {
    await createPeerConnection();

  }

  await remoteSession.pc.setRemoteDescription(offer);

  const answer = await remoteSession.pc.createAnswer();
  sendMessage({ type: 'answer', sdp: answer.sdp });
  await remoteSession.pc.setLocalDescription(answer);
}

async function handleAnswer(answer) {
  if (!remoteSession.pc) {
    console.error('no peerconnection');
    return;
  }
  await remoteSession.pc.setRemoteDescription(answer);
}

function renegotiate() {
  sendOffer();
}

async function handleCandidate(candidate) {
  if (!remoteSession.pc) {
    console.error('no peerconnection');
    return;
  }
  if (!candidate.candidate) {
    await remoteSession.pc.addIceCandidate(null);
  } else {
    await remoteSession.pc.addIceCandidate(candidate);
  }
}

async function renderVideoSources() {
  await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
  const devices = await navigator.mediaDevices.enumerateDevices();
  const videoDevices = devices.filter(device => device.kind === 'videoinput');

  videoSourceSelect.innerHTML = '';

  if (!videoDevices.length) {
    console.error('no video devices');
    return;
  }

  videoDevices.forEach(device => {
    const option = document.createElement('option');
    option.value = device.deviceId;
    option.innerHTML = device.label;
    videoSourceSelect.appendChild(option);
  });

  console.log('videoDevices', videoDevices);

  videoSourceSelect.value = videoDevices[0].deviceId;
}

renderVideoSources().then(() => {
  addVideoButton.click();
})