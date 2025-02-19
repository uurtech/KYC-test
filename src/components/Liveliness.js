import React,{ useState, useEffect } from "react";
import Webcam from "react-webcam";
import Button from 'react-bootstrap/Button'
import gest_data from './gestures.json'
import Card from "react-bootstrap/Card"
import ProgressBar from "react-bootstrap/ProgressBar"
import _ from 'lodash'
import Jimp from 'jimp'

import { Auth, Logger } from 'aws-amplify'
import AWS from 'aws-sdk'
import awsConfig from "../aws-exports"

const logger = new Logger('kyc','INFO');
AWS.config.update({region:awsConfig.aws_cognito_region});


const videoConstraints = {
    width: 1280,
    height: 720,
    facingMode: "user"
  };

  export default ({setTabStatus, setLiveTestDetails}) => {
    const [gesture, setGesture] = useState(null);
    const [showSpinner,setShowSpinner] = useState(false);
    const [alertMessage, setAlertMessage] = useState("You will be asked to do a series of random gestures which will enable us to detect a live feed.  ");
    const [showProgress, setShowProgress] = useState(false);
    const [showWebcam, setShowWebcam] = useState(false);
    const [progressValue, setProgressValue] = useState(5);

    // identification state from liveness test
    const [liveGender, setLiveGender] = useState("");
    const [ageRange, setAgeRange] = useState("");    
    const [liveImage, setLiveImage] = useState(null);

    const [frames, setFrames] = useState([]);
    const [isCapturingFrames, setIsCapturingFrames] = useState(false);
    const [brightnessValues, setBrightnessValues] = useState([]);

    useEffect(() => {
        Auth.currentCredentials().then(function(creds){
            AWS.config.update(creds);   
        })
    },[])

    useEffect(() => {
      if(gesture !== null)  {
        const description = getGestureDescription(gesture)  
        setAlertMessage(description + ". Click button to continue =>  ")
      }
  
    },[gesture])

    const getGestureDescription = (gesture) => {
        return _.find(gest_data, function(gest){
            return gest.name === gesture;
        }).description
    }
    
    const proceedToNext = () => {
        setLiveTestDetails({
           liveGender:liveGender,
           ageRange:ageRange,
           liveImage:liveImage 
        })  
      setTabStatus("UploadDocs");
    }

    const updateGestureState = () => {
        // update current gesture state to true
        // update next gesture
        if (gesture === "smile") {
            setProgressValue(25)
            setGesture("lookRight")
        } else if (gesture === "lookRight") {
            setProgressValue(50)
            setGesture("mouthOpen")
        } else if (gesture === "mouthOpen") {
            setProgressValue(75)
            setGesture("idRotation")
        } else if (gesture === "idRotation") {
            setProgressValue(100)
            setShowWebcam(false);
        }
    }

    const analyzeHologram = async (imageBuffer) => {
        try {
            const image = await Jimp.read(imageBuffer);
            let brightness = 0;
            let highlights = 0; // Count of bright spots
            
            // Calculate average brightness and detect highlights
            image.scan(0, 0, image.bitmap.width, image.bitmap.height, (x, y, idx) => {
                const red = image.bitmap.data[idx];
                const green = image.bitmap.data[idx + 1];
                const blue = image.bitmap.data[idx + 2];
                const pixelBrightness = (red + green + blue) / 3;
                brightness += pixelBrightness;
                
                // Count highlights (very bright spots typical in hologram reflections)
                if (pixelBrightness > 200) { // Threshold for highlight detection
                    highlights++;
                }
            });
            
            brightness = brightness / (image.bitmap.width * image.bitmap.height);
            const highlightRatio = highlights / (image.bitmap.width * image.bitmap.height);
            
            return {
                averageBrightness: brightness,
                highlightRatio: highlightRatio
            };
        } catch (error) {
            console.error('Error analyzing hologram:', error);
            return null;
        }
    }

    const validateHologram = (brightnessValues) => {
        if (brightnessValues.length < 10) {
            return { result: false, message: "Please complete the rotation of the ID card" };
        }

        // Calculate variations in both average brightness and highlights
        const avgBrightnessValues = brightnessValues.map(v => v.averageBrightness);
        const highlightRatioValues = brightnessValues.map(v => v.highlightRatio);

        const maxBrightness = Math.max(...avgBrightnessValues);
        const minBrightness = Math.min(...avgBrightnessValues);
        const brightnessRange = maxBrightness - minBrightness;

        const maxHighlightRatio = Math.max(...highlightRatioValues);
        const minHighlightRatio = Math.min(...highlightRatioValues);
        const highlightRatioRange = maxHighlightRatio - minHighlightRatio;

        // Check for significant changes in either brightness or highlight patterns
        const hasBrightnessChange = brightnessRange > 15; // Lowered from 20
        const hasHighlightChange = highlightRatioRange > 0.05; // 5% change in highlight coverage

        // Calculate the rate of change between consecutive frames
        let significantChanges = 0;
        for (let i = 1; i < brightnessValues.length; i++) {
            const brightnessDiff = Math.abs(avgBrightnessValues[i] - avgBrightnessValues[i-1]);
            const highlightDiff = Math.abs(highlightRatioValues[i] - highlightRatioValues[i-1]);
            
            if (brightnessDiff > 5 || highlightDiff > 0.02) {
                significantChanges++;
            }
        }

        // Validate based on multiple criteria
        if ((hasBrightnessChange && significantChanges >= 3) || 
            (hasHighlightChange && significantChanges >= 2) ||
            (significantChanges >= 4)) {
            return { result: true, message: "Hologram verification successful!" };
        } else if (significantChanges >= 1) {
            return { result: false, message: "Some reflection detected. Please rotate the ID card more slowly" };
        } else {
            return { result: false, message: "Please rotate the ID card to show the hologram clearly" };
        }
    }

    const validateGesture = (gesture, data) => {
        logger.info("Validating gesture", data);
        if (gesture === "idRotation") {
            return validateHologram(brightnessValues);
        }

        if (data.length === 0) {
            return { result: false, message: "Could not recognize a face. Try again " }
        }

        if (data.length > 1) {
            return { result: false, message: "More than one face. Try again " }
        }

        logger.info(data.FaceDetails[0])

        if(gesture === "smile"){
            
            if(data.FaceDetails[0].Smile.Value === true){
                return {result:true, message:"Thank you"}
            } else {
                return {result:false, message:"Failed to validate smile. Try again "}
            }
            
        } else if(gesture === "lookRight") {
            if(data.FaceDetails[0].Pose.Yaw <= -30){
                return {result:true, message:"Thank you"}
            } else {
                return {result:false, message:"Failed to validate face turning right. Try again "}
            }
        } else if(gesture === "mouthOpen") {
            if(data.FaceDetails[0].MouthOpen.Value === true){
                return {result:true, message:"You can successfully completed Liveness checks !! "}
            } else {
                return {result:false, message:"Failed to validate open mouth. Try again "}
            }
        }

        return {result:false, message:"Unkown gesture type specified"}
    }

    const requestGesture = async () => {
        try {
            if (!webcamRef.current) {
                setAlertMessage("Webcam is not ready. Please wait a moment and try again.");
                return;
            }

            setShowSpinner(true);

            if (gesture === "idRotation") {
                // Start capturing frames for hologram detection
                if (!isCapturingFrames) {
                    setIsCapturingFrames(true);
                    setBrightnessValues([]);
                    let frameCount = 0;
                    const captureInterval = setInterval(async () => {
                        const imageBase64String = webcamRef.current.getScreenshot();
                        if (imageBase64String) {
                            const base64Image = imageBase64String.split(';base64,').pop();
                            const imageBuffer = Buffer.from(base64Image, 'base64');
                            const analysis = await analyzeHologram(imageBuffer);
                            if (analysis !== null) {
                                setBrightnessValues(prev => [...prev, analysis]);
                            }
                            frameCount++;
                            
                            // Update message during capture
                            if (frameCount < 10) {
                                setAlertMessage("Keep rotating the ID card slowly... " + (10 - frameCount) + " seconds remaining");
                            }
                            
                            if (frameCount >= 10) {
                                clearInterval(captureInterval);
                                setIsCapturingFrames(false);
                                const result = validateHologram(brightnessValues);
                                setAlertMessage(result.message);
                                setShowSpinner(false);
                                if (result.result) {
                                    updateGestureState();
                                }
                            }
                        }
                    }, 500); // Capture frame every 500ms
                    return;
                }
            }

            // Regular face detection flow
            const imageBase64String = webcamRef.current.getScreenshot();
            if (!imageBase64String) {
                setAlertMessage("Failed to capture image. Please ensure camera permissions are granted.");
                setShowSpinner(false);
                return;
            }

            const base64Image = imageBase64String.split(';base64,').pop();
            const imageBuffer = Buffer.from(base64Image, 'base64');

            let rekognition = new AWS.Rekognition();
            let params = {
                Attributes: ["ALL"],
                Image: {
                    Bytes: imageBuffer
                }
            };
            
            let faceDetectResponse = await rekognition.detectFaces(params).promise()

            if (faceDetectResponse.$response.error) {
                setShowSpinner(false);
                setAlertMessage(faceDetectResponse.$response.error.message)
                return new Promise((resolve, reject) => {
                    throw new Error(faceDetectResponse.$response.error.message);
                }) 
            }
            else { 
                let validationResult = validateGesture(gesture, faceDetectResponse) 
                if(validationResult.result){
                    if(gesture === 'smile'){

                        // set the gender
                        setLiveGender(faceDetectResponse.FaceDetails[0].Gender.Value)
                        setAgeRange(faceDetectResponse.FaceDetails[0].AgeRange.Value)

                        // get the bounding box
                        let imageBounds = faceDetectResponse.FaceDetails[0].BoundingBox
                        logger.info(imageBounds)
                        // crop the face and store the image
                        Jimp.read(imageBuffer, (err, image) => {
                            if (err) throw err;
                            else {
                            
                            image.crop(image.bitmap.width*imageBounds.Left - 15, image.bitmap.height*imageBounds.Top - 15, image.bitmap.width*imageBounds.Width + 30, image.bitmap.height*imageBounds.Height + 30)
                                .getBase64(Jimp.MIME_JPEG, function (err, base64Image) {
                                    setLiveImage(base64Image)
                                })
                            }
                        })

                        // update gesture state
                        setAlertMessage(validationResult.message)
                        setShowSpinner(false);
                        updateGestureState();    
                    } else {
                        // update gesture state
                        setAlertMessage(validationResult.message)
                        setShowSpinner(false);
                        updateGestureState();
                    }
                } else {
                    // unable to validate gesture - set Error Message
                    setAlertMessage(validationResult.message)
                    setShowSpinner(false);
                }     
            }     
        } catch (error) {
            setShowSpinner(false);
            setAlertMessage(error.message);
        }
    }

    function start_test(evt){
      setShowProgress(true);
      setShowWebcam(true);
      setGesture("smile")
    }

    const webcamRef = React.useRef(null);
   
   
    return (
      <>
        <Card>
            <Card.Header>
                {alertMessage} 
                {!showProgress && <Button variant="primary" onClick={start_test}>Start</Button>}
                {showProgress && progressValue < 100 && <Button variant="primary" onClick={requestGesture}>Validate</Button>}
                {progressValue === 100 && <Button variant="primary" onClick={proceedToNext}>Continue</Button>}
            </Card.Header>
            
            <Card.Body>
                {showSpinner && <div className="spinner" ></div>}
                {showWebcam && <div className="video-padding">
                        <Webcam
                            audio={false}
                            height={450}
                            ref={webcamRef}
                            screenshotFormat="image/jpeg"
                            width={800}
                            raints={videoConstraints}
                        />
                        
                    </div>
                }
                
                {showProgress &&  <div className="live-progressbar"><ProgressBar now={progressValue} label={`${progressValue}%`} /></div> }

            </Card.Body>
        </Card>
      </>
    );
  };
