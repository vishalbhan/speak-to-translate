import { AssemblyAI } from 'assemblyai';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Add this logging to check the API key
    console.log('API Key available:', !!process.env.ASSEMBLYAI_API_KEY);
    console.log('API Key:', process.env.ASSEMBLYAI_API_KEY?.substring(0, 5) + '...');

    if (!process.env.ASSEMBLYAI_API_KEY) {
      console.error('AssemblyAI API key is not defined');
      return NextResponse.json({ error: 'AssemblyAI API key is not configured' }, { status: 500 });
    }

    // Move client creation inside the function to ensure API key is available
    const client = new AssemblyAI({
      apiKey: process.env.ASSEMBLYAI_API_KEY
    });

    console.log('Attempting to create temporary token...');
    const token = await client.realtime.createTemporaryToken({ expires_in: 300 });
    
    if (!token) {
      console.error('Token generation failed - no token returned');
      return NextResponse.json({ error: 'Failed to generate token' }, { status: 500 });
    }

    console.log('Token generated successfully');
    return NextResponse.json({ token });
  } catch (error) {
    console.error('Token generation error:', error);
    return NextResponse.json({ 
      error: 'Failed to generate token', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 