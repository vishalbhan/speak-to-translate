class AudioProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 4096; // Smaller buffer for faster processing
    this.buffer = new Float32Array(this.bufferSize);
    this.bufferIndex = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    const channel = input[0];
    
    if (channel && channel.length > 0) {
      // Fill buffer
      for (let i = 0; i < channel.length; i++) {
        this.buffer[this.bufferIndex++] = channel[i];
        
        // When buffer is full, send it
        if (this.bufferIndex >= this.bufferSize) {
          const int16Array = new Int16Array(this.bufferSize);
          for (let j = 0; j < this.bufferSize; j++) {
            const s = Math.max(-1, Math.min(1, this.buffer[j]));
            int16Array[j] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }
          
          this.port.postMessage(int16Array.buffer, [int16Array.buffer]);
          this.bufferIndex = 0;
        }
      }
    }
    
    return true;
  }
}

registerProcessor('audio-processor', AudioProcessor); 