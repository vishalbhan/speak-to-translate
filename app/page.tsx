'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import the Recorder component to avoid SSR issues
const Recorder = dynamic(() => import('@/components/Recorder'), {
  ssr: false,
});

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-6xl bg-white shadow-md rounded-lg p-4 flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
        <Recorder />
      </div>
    </div>
  );
}
