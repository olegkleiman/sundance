//
//  audioEngine.js
//
//  Created by Oleg on 17/01/2025.
//

class AudioEngine {
    constructor(language, 
                recognitionStartedCallback, 
                recognitionEndedCallback,
                recornition_resultCallback) {
        this.lang = language;
        this.recognizing = false;

        // Initialize the speech recognition
        if( 'webkitSpeechRecognition' in window )
        {
            this.recognition = new (window.webkitSpeechRecognition || 
                    window.webkitSpeechRecognition ||
                    window.mozSpeechRecognition ||
                    window.msSpeechRecognition)();

            this.recognition.continuous = true; // when the user stops talking, speech recognition will end.
            this.recognition.interimResults = false; // if false only results returned by the recognizer are final and will not change. 
            this.recognition.lang = language;

            this.recognition.onstart = () => {
                console.log('Speech recognition started');
                this.recognizing = true;

                recognitionStartedCallback?.call(this);
            }
            
            this.recognition.onend = () => {
                console.log('Speech recognition ended');
                this.recognizing = false;
                // this.recognition.stop();

                recognitionEndedCallback?.call(this);
            }

            this.recognition.onerror = (event) => {
                console.error(`Speeech recognition error: ${event.error}`);
                this.recognizing = false;
                recognitionEndedCallback?.call(this);
            };

            this.recognition.onresult = (event) => {
                console.log('Speech recognition result');
                let final_transcript = '';
                let interim_transcript = '';

                for (var i = event.resultIndex; i < event.results.length; ++i) {
                    if (event.results[i].isFinal) {
                        final_transcript += event.results[i][0].transcript;
                        console.log(final_transcript);
                        this.recognition.stop();
                        recornition_resultCallback?.call(this, final_transcript);
                        // speak(final_transcript)
                    } else {
                        interim_transcript += event.results[i][0].transcript;
                    }
                }
            }
        }

        // Initialize the speech synthesis
        if( 'speechSynthesis' in window ) { 
            this.speechSynthesis = window.speechSynthesis;
            const voices = this.speechSynthesis.getVoices().filter( voice => voice.lang === this.lang );
            this.voice = voices[0];
        }
    }

    startRecognition = () => {
        if (this.recognizing) {
            this.recognition.stop();
            return;
        }
        this.recognition.start();
    }

    speak = (text) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = this.lang;
        utterance.pitch = 1;
        utterance.rate = 1;
        utterance.voice = this.voice;
        speechSynthesis.speak(utterance);
    }

    playRawAudioData = (binaryAudioData) => {

        var audioCtx = new (window.AudioContext || window.webkitAudioContext)();

        const source = audioCtx.createBufferSource();

        audioCtx.decodeAudioData(binaryAudioData.buffer.slice(0), function(buffer) {
            source.buffer = buffer;
            source.connect(audioCtx.destination);
            source.start();
        })       
    }
}

export default AudioEngine;