import * as React from 'react';
import {createRoot} from 'react-dom/client';
import { Map, Marker, ZoomControl, Overlay } from "pigeon-maps"
import { animated, useSpring } from 'react-spring';


import '../src/assets/style.css';
function getRandomColor() {
  const min = 50; // Minimum RGB value
  const max = 200; // Maximum RGB value

  // Generate a random number between min and max for each RGB value
  const red = Math.floor(Math.random() * (max - min + 1)) + min;
  const green = Math.floor(Math.random() * (max - min + 1)) + min;
  const blue = Math.floor(Math.random() * (max - min + 1)) + min;

  // Convert the RGB values to a hex color string
  const color = `#${red.toString(16)}${green.toString(16)}${blue.toString(16)}`;

  return color;
}

const App: React.FC = () => {
  const hostRef = React.useRef(false);
  const markersRef = React.useRef<Array<[number, number]>>([]);
  const localMouseMoveRef = React.useRef<[number, number]>([0, 0]);
  const isInitialMount = React.useRef(true);

  const [prompt, setPrompt] = React.useState<string>("");
  const promptRef = React.useRef<string>("");
  

  const [remoteMarkers, setRemoteMarkers] = React.useState<Array<any>>([]);
  const [localMarker, setLocalMarker] = React.useState<any>();
  const [remoteMousePositions, setRemoteMousePositions] = React.useState<Array<any>>([]);

  const [zoomLevel, setZoomLevel] = React.useState<number>(3);
  const [latLng, setLatLng] = React.useState<[number, number]>([51.4826, -0.0077]);

  const zoomRef = React.useRef<number>(11);

  const [mousePosition, setMousePosition] = React.useState<[number, number]>([0, 0]);
  const [listenerSet, setListenerSet] = React.useState<boolean>(false);
  const [userName, setUserName] = React.useState<string>("");
  const [userId, setUserId] = React.useState<string>();
  const userIdRef = React.useRef<string>();
  const [started, setStarted] = React.useState<boolean>(false);
  const [host, setHost] = React.useState<boolean>(false)
  const [cursorsOn, setCursorsOn] = React.useState<boolean>(false)

  const color = getRandomColor()
  const [markerColor, setMarkerColor] = React.useState<string>(color);

  const handleMapClick = (event: any) => {
    const newLocalMarker = {userId: userId, userName: userName, lat: event.latLng[0], lng: event.latLng[1], markerColor: markerColor, zoom: zoomRef.current};
    setLocalMarker(newLocalMarker);
    miro.board.events.broadcast('message', {messageType: 'marker', messageContents : newLocalMarker});
  }

  React.useEffect(() => {
    const mergedMarkers = [...remoteMarkers, ...(localMarker ? [localMarker] : [])];
    markersRef.current = mergedMarkers;
  }, [remoteMarkers, localMarker]);

  const handleMouseMove = (event: React.MouseEvent) => {
    setMousePosition([event.clientX, event.clientY]);
    localMouseMoveRef.current = [event.clientX, event.clientY];
  }

  const markerClick = (lat: number, lng: number, zoom: number) => {
    setLatLng([lat, lng]);
    setZoomLevel(zoom);
  }

  const updateMouseLocation = (event) => {
    //console.log(event);
    setMousePosition([event.center[0], event.center[1]]);
    localMouseMoveRef.current = [event.center[0], event.center[1]];
    zoomRef.current = event.zoom;
    setZoomLevel(event.zoom);
    setLatLng([event.center[0], event.center[1]]);
  }

  React.useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
    } else {
      const messageContents = {lat: localMouseMoveRef.current[0], lng: localMouseMoveRef.current[1], userId: userId, userName: userName, markerColor: markerColor};
      //console.log(messageContents);
      miro.board.events.broadcast('message', {messageType: 'mouseMove',messageContents : messageContents});
    }
  }, [mousePosition]);

  React.useEffect(() => {
    const addListener = async () => {
      miro.board.events.on('message', async (message) => {
        console.log(message);
        if (message.messageType === 'marker'){
          const newMarker = message.messageContents
          
          setRemoteMarkers(prevMarkers => {
            const markerIndex = prevMarkers.findIndex(marker => marker.userId === newMarker.userId);

            if (markerIndex !== -1) {
              // A marker with the matching userId exists, replace it
              return prevMarkers.map((marker, index) => index === markerIndex ? newMarker : marker);
            } else {
              // No marker with the matching userId exists, add the new marker
              return [...prevMarkers, newMarker];
            }
          });

        }
        if (message.messageType === 'requestStatus' && hostRef.current){
          const filteredMarkers = markersRef.current.filter(marker => marker.userId !== message.userId);
          miro.board.events.broadcast('message', {messageType: 'responseStatus', messageContents : markersRef.current, prompt: promptRef.current});
        }
        if (message.messageType === 'responseStatus'){
          const remoteMarkers = message.messageContents.filter(marker => marker.userId !== userIdRef.current);
          const localMarker = message.messageContents.find(marker => marker.userId === userIdRef.current);
          setRemoteMarkers(remoteMarkers);
          if (localMarker){
            setLocalMarker(localMarker);
            setMarkerColor(localMarker.markerColor)
          }
          setPrompt(message.prompt);
          setStarted(true);
        }
        if (message.messageType === 'mouseMove' && message.messageContents.userId !== userId){
          const newMousePosition = message.messageContents
          setRemoteMousePositions(prevPositions => {
            const positionIndex = prevPositions.findIndex(position => position.userId === newMousePosition.userId);
            if (positionIndex !== -1) {
              // A position with the matching userId exists, replace it
              return prevPositions.map((position, index) => index === positionIndex ? newMousePosition: position);
            } else {
              // No position with the matching userId exists, add the new position
              return [...prevPositions, newMousePosition];
            }
          });
        }

      });
      setListenerSet(true);

    }

    const getUserName = async () => {
      const userInfo = await miro.board.getUserInfo();
      setUserName(userInfo.name);
      setUserId(userInfo.id);
      userIdRef.current = userInfo.id;
    };
    
    if (!listenerSet){
        addListener();
    }
    getUserName();
  }, []);

  const startRoom = () => {
    setStarted(true);
    setHost(true);
    hostRef.current = true
  }

  React.useEffect(() => {
    const requestStatus = async () => {
      miro.board.events.broadcast('message', {messageType: 'requestStatus', userId: userId});
    };

    if (userId) {
      requestStatus();
    }
  }, [userId]);

  const handleCheckboxChange = (event) => {
    console.log(event.target.checked); 
    setCursorsOn(event.target.checked);
  };

  return (
    <div className="grid wrapper">
      {!started && <div className="cs1 ce12">
        <div className="form-group">
              <label for="example-1">Prompt for the room</label>
              <input className="input" type="text" placeholder="What's your favorite place in the world?" id="prompt"/>
            </div>
          </div>
      }
      {!started && <div className="cs1 ce12 centered">
        <button
          className="button button-primary"
          onClick= {() => {
            setStarted(true)
            setHost(true)
            hostRef.current = true
            const prompt = (document.getElementById("prompt") as HTMLInputElement).value
            setPrompt(prompt)
            promptRef.current = prompt
            miro.board.events.broadcast('message', {messageType: 'responseStatus', messageContents : markersRef.current, prompt: promptRef.current});
          }}
        >
          Start Room
        </button>
      </div>
      } 
      {started && <div className="cs1 ce10">
          <div>
            <h1 className="h1">{prompt}</h1>
          </div>
        </div>
      }
      {started && <div className="cs11 ce12">
          <label class="toggle">
              <input type="checkbox" tabindex="0" onChange={handleCheckboxChange}/>
              <span>Cursors On</span>
          </label>
        </div>
      }
       {started && <div className="cs1 ce12">
        <Map height="100vh" center={latLng} zoom={zoomLevel} onClick={handleMapClick} onBoundsChanged={updateMouseLocation}>
          <ZoomControl />
          {localMarker && <Marker width={50} anchor={[localMarker.lat, localMarker.lng]} hover={true} color={markerColor}/>}
          {remoteMarkers.map((marker, index) => (
            <Marker key={`marker-${index}`} anchor={[marker.lat, marker.lng]} payload={1} color={marker.markerColor} onClick={() => markerClick(marker.lat, marker.lng, marker.zoom)}/>
          ))}
          {cursorsOn && remoteMousePositions.map((position, index) => {
          const calculateWidth = (text, fontSize = 16) => {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            context.font = `${fontSize}px Arial`;
            return context.measureText(text).width;
          };

          const textWidth = calculateWidth(position.userName);

          return (
            <Marker key={`marker-${index}`} anchor={[position.lat, position.lng]} payload={1} color={position.markerColor}>
              <svg width={textWidth+10} height={50} version="1" xmlns="http://www.w3.org/2000/svg" viewBox="0 -10 48 48" enable-background="new 0 0 48 48" transform="translate(60, -20)">
                <text x="50%" y="20%" dominant-baseline="middle" text-anchor="middle" fill={position.markerColor}>{position.userName}</text>
              </svg>
              <svg width={50} height={50} version="1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" enable-background="new 0 0 48 48">
                  <path fill={position.markerColor} d="M27.8,39.7c-0.1,0-0.2,0-0.4-0.1c-0.2-0.1-0.4-0.3-0.6-0.5l-3.7-8.6l-4.5,4.2C18.5,34.9,18.3,35,18,35 c-0.1,0-0.3,0-0.4-0.1C17.3,34.8,17,34.4,17,34l0-22c0-0.4,0.2-0.8,0.6-0.9C17.7,11,17.9,11,18,11c0.2,0,0.5,0.1,0.7,0.3l16,15 c0.3,0.3,0.4,0.7,0.3,1.1c-0.1,0.4-0.5,0.6-0.9,0.7l-6.3,0.6l3.9,8.5c0.1,0.2,0.1,0.5,0,0.8c-0.1,0.2-0.3,0.5-0.5,0.6l-2.9,1.3 C28.1,39.7,27.9,39.7,27.8,39.7z"/>
                  <path fill="black" d="M18,12l16,15l-7.7,0.7l4.5,9.8l-2.9,1.3l-4.3-9.9L18,34L18,12 M18,10c-0.3,0-0.5,0.1-0.8,0.2 c-0.7,0.3-1.2,1-1.2,1.8l0,22c0,0.8,0.5,1.5,1.2,1.8C17.5,36,17.8,36,18,36c0.5,0,1-0.2,1.4-0.5l3.4-3.2l3.1,7.3 c0.2,0.5,0.6,0.9,1.1,1.1c0.2,0.1,0.5,0.1,0.7,0.1c0.3,0,0.5-0.1,0.8-0.2l2.9-1.3c0.5-0.2,0.9-0.6,1.1-1.1c0.2-0.5,0.2-1.1,0-1.5 l-3.3-7.2l4.9-0.4c0.8-0.1,1.5-0.6,1.7-1.3c0.3-0.7,0.1-1.6-0.5-2.1l-16-15C19,10.2,18.5,10,18,10L18,10z"/>
              </svg>
            </Marker>
          );
        })}
        </Map>
        
      </div>
      } 
    </div>
  );
};

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);