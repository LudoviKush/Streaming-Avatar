import React, { useState, useEffect, useRef, useCallback } from "react";
const DID_API = {
  key: "cGV5ZWwxMDYyOUBpcm5pbmkuY29t:MJFaVyhwkGNgHdBSxBC0S",
  url: "https://api.d-id.com",
  service: "talks",
};

function Avatar() {
  // States for all the labels and buttons
  const [peerStatus, setPeerStatus] = useState("");
  const [iceStatus, setIceStatus] = useState("");
  const [iceGatheringStatus, setIceGatheringStatus] = useState("");
  const [signalingStatus, setSignalingStatus] = useState("");
  const [streamingStatus, setStreamingStatus] = useState("");

  // Refs for the video element and the peer connection
  const videoElement: any = useRef(null);

  const [peerConnection, setpeerConnection] = useState<any | null>(null);
  // Refs for IDs and statuses
  let sessionClientAnswer;

  const [streamId, setstreamId] = useState("");
  const [newSessionId, setnewSessionId] = useState("");

  let videoIsPlaying = false;
  let lastBytesReceived;
  const maxRetryCount = 3;
  const maxDelaySec = 4;

  const presenterInputByService = {
    talks: {
      source_url: "https://d-id-public-bucket.s3.amazonaws.com/or-roman.jpg",
    },
    clips: {
      presenter_id: "rian-lZC6MmWfC1",
      driver_id: "mXra4jY38i",
    },
  };

  // Check API key
  useEffect(() => {
    return () => {
      stopAllStreams();
      closePC();
      // Any other cleanup can go here
    };
  }, []);

  useEffect(() => {
    if (peerConnection) {
      peerConnection.onicegatheringstatechange = onIceGatheringStateChange;
      peerConnection.onicecandidate = onIceCandidate;
      peerConnection.oniceconnectionstatechange = onIceConnectionStateChange;
      peerConnection.onconnectionstatechange = onConnectionStateChange;
      peerConnection.onsignalingstatechange = onSignalingStateChange;
      peerConnection.ontrack = onTrack;
      setpeerConnection(peerConnection);
      console.log("peerConnection add Eventlisteners\n\n", peerConnection);
    }
  }, [peerConnection]);

  const playIdleVideo = () => {
    console.log("Playing idle video");
    videoElement.current.src = "https://github.com/LudoviKush/avatartest/raw/main/oracle_Idle.mp4";
    videoElement.current.loop = true;
    videoElement.current.play().catch((e) => console.error("Error playing video:", e));
};

  const stopAllStreams = () => {
    // Check if the peer connection exists and has streams
    if (videoElement.current.srcObject) {
      console.log("stopping video streams");
      videoElement.current.srcObject
        .getTracks()
        .forEach((track) => track.stop());
      videoElement.current.srcObject = null;
    }
  };

  const closePC = () => {
    if (peerConnection) {
      // Close the peer connection
      peerConnection.close();
      setpeerConnection(null);
      setPeerStatus("closed");
      setIceStatus("");
      setSignalingStatus("no signaling");
      setStreamingStatus("Stream ended");
      peerConnection.ontrack = null;
      console.log("stopped peer connection");
    }
  };

  // Handlers for peer connection state changes
  const onIceGatheringStateChange = () => {
    if (peerConnection) {
      const status = peerConnection.iceGatheringState;
      setIceGatheringStatus(status);
    }
  };

  const onIceCandidate = (event) => {
    if (event.candidate) {
      const { candidate, sdpMid, sdpMLineIndex } = event.candidate;
      fetch(`${DID_API.url}/${DID_API.service}/streams/${streamId}/ice`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${DID_API.key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          candidate,
          sdpMid,
          sdpMLineIndex,
          session_id: newSessionId,
        }),
      });
    }
  };

  const onIceConnectionStateChange = () => {
    const status = peerConnection.iceConnectionState;
    setIceStatus(status);
    if (status === "failed" || status === "closed") {
      stopAllStreams();
      closePC();
    }
  };

  const onConnectionStateChange = () => {
    const status = peerConnection.connectionState;
    setPeerStatus(status);
  };

  const onSignalingStateChange = () => {
    const status = peerConnection.signalingState;
    setSignalingStatus(status);
  };

  const onVideoStatusChange = (videoIsPlaying, stream) => {
    if (stream) {
      console.log(videoIsPlaying, stream, 'video stream')
      runVideoElement(stream);
      setStreamingStatus("streaming");
    } else {
      playIdleVideo();
      setStreamingStatus("empty");
    }
  };

  const runVideoElement = (stream) => {
    if (!stream) return;
    videoElement.current.srcObject = stream;
    videoElement.current.loop = false;
    if (videoElement.current.paused) {
      videoElement.current.play().catch((e) => console.error("Error playing video:", e));
    }
  };

  let _debug = false;
  const log = (message: string, extra?: any) => _debug && console.log(message, extra);

  const onTrack = (event: RTCTrackEvent) => {
    log('peerConnection.ontrack', event);
    if (event.streams && event.streams.length > 0) {
      const remoteStream = event.streams[0];
      videoElement.current.srcObject = remoteStream;
      onVideoStatusChange(true, remoteStream);
    } else {
      onVideoStatusChange(false, null);
    }
  };

  // Other utility functions like createPeerConnection, setVideoElement, etc.
  const createPeerConnection = async (offer, iceServers) => {
    const peerConnection = new RTCPeerConnection({ iceServers });

    const remoteDescription = new RTCSessionDescription(offer);
    await peerConnection.setRemoteDescription(remoteDescription);
    console.log("set remote sdp OK");

    const sessionClientAnswer = await peerConnection.createAnswer();
    console.log("create local sdp OK");

    await peerConnection.setLocalDescription(sessionClientAnswer);
    console.log("set local sdp OK");

    setpeerConnection(peerConnection);
    return sessionClientAnswer;
  };
  const fetchWithRetries = async (url, options, retries = 1) => {
    try {
      return await fetch(url, options);
    } catch (err) {
      if (retries <= maxRetryCount) {
        const delay =
          Math.min(Math.pow(2, retries) / 4 + Math.random(), maxDelaySec) *
          1000;

        await new Promise((resolve) => setTimeout(resolve, delay));

        console.log(
          `Request failed, retrying ${retries}/${maxRetryCount}. Error ${err}`,
        );
        return fetchWithRetries(url, options, retries + 1);
      } else {
        throw new Error(`Max retries exceeded. error: ${err}`);
      }
    }
  };

  // Handler functions for buttons
  const handleConnectClick = useCallback(async () => {
    if (peerConnection && peerConnection.connectionState === "connected") {
      return;
    }
  
    stopAllStreams();
    closePC();
  
    const sessionResponse = await fetchWithRetries(
      `${DID_API.url}/${DID_API.service}/streams`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${DID_API.key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(presenterInputByService[DID_API.service]),
      }
    );
  
    const {
      id: newStreamId,
      offer,
      ice_servers: iceServers,
      session_id: newSessionId,
    } = await sessionResponse.json();
    const localStreamId = newStreamId;
    sessionStorage.setItem("streamId", newStreamId);
    setstreamId(localStreamId);
    setnewSessionId(newSessionId);
  
    try {
      sessionClientAnswer = await createPeerConnection(offer, iceServers);
      // Play the idle video after creating the peer connection
      playIdleVideo();
    } catch (e) {
      console.log("error during streaming setup", e);
      stopAllStreams();
      closePC();
      return;
    }

    const sdpResponse = await fetch(
      `${DID_API.url}/${DID_API.service}/streams/${sessionStorage.getItem("streamId")}/sdp`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${DID_API.key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          answer: sessionClientAnswer,
          session_id: newSessionId,
        }),
      },
    );
  }, [streamId]);

  const handleStartClick = async () => {
    // connectionState not supported in firefox
    if (
      peerConnection?.signalingState === "stable" ||
      peerConnection?.iceConnectionState === "connected"
    ) {
      const playResponse = await fetchWithRetries(
        `${DID_API.url}/${DID_API.service}/streams/${streamId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${DID_API.key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            script: {
              type: "text",
              subtitles: "false",
              provider: {
                type: "microsoft",
                voice_id: "en-US-JennyNeural",
                // voice_config: {
                //   style: "string",
                //   rate: "0.5",
                //   pitch: "+2st",
                // },
                language: "English (United States)",
              },
              ssml: true,
              input: "Hello World! And welcome to getitAI.",
            },
            ...(DID_API.service === "clips" && {
              background: {
                color: "#FFFFFF",
              },
            }),
            config: {
              stitch: true,
            },
            session_id: newSessionId,
          }),
        },
      );
      console.log("playResponse", playResponse);
    }
  };

  const handleDestroyClick = async () => {
    await fetch(`${DID_API.url}/${DID_API.service}/streams/${streamId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Basic ${DID_API.key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ session_id: newSessionId }),
    });

    stopAllStreams();
    closePC();
  };

  // Rendering
  return (
    <div>
      <video width="400" height="400" ref={videoElement} autoPlay muted />
      <div>
        <li>iceGatheringStatus: {iceGatheringStatus} </li>
        <li>iceStatus: {iceStatus} </li>
        <li>PeerStatus: {peerStatus} </li>
        <li>signalingStatus: {peerConnection?.signalingState} </li>
        <li>streamingStatus: {streamingStatus} </li>
      </div>
      <button className="btn" onClick={handleConnectClick}>
        Connect
      </button>
      <button className="btn" onClick={handleStartClick}>
        Start
      </button>
      <button className="btn" onClick={handleDestroyClick}>
        Destroy
      </button>
    </div>
  );
}

export default Avatar;
