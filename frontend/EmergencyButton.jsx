import React from 'react';
import { motion } from 'framer-motion';

/**
 * EmergencyButton Component
 * 
 * A premium, fixed-position emergency trigger button with modern aesthetics.
 * Features:
 * - Fixed top-right positioning
 * - Glassmorphic pulse effect
 * - Smooth framer-motion animations
 * - Responsive design
 */
const EmergencyButton = () => {
    const handleEmergencyClick = () => {
        alert("Emergency alert triggered. Authorities have been notified. (Demo mode)");
    };

    return (
        <motion.button
            id="emergency-trigger"
            initial={{ scale: 0, opacity: 0, y: -20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            whileHover={{
                scale: 1.1,
                backgroundColor: "#ff5f56",
                boxShadow: "0 0 30px rgba(248, 81, 73, 0.7)"
            }}
            whileTap={{ scale: 0.95 }}
            onClick={handleEmergencyClick}
            className="fixed top-8 right-8 z-[1000] w-16 h-16 bg-[#f85149] text-white rounded-full flex items-center justify-center cursor-pointer border-none shadow-2xl overflow-hidden group transition-colors duration-300"
            aria-label="Trigger Emergency Alert"
        >
            {/* Background Ripple Animation */}
            <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity duration-300"></div>

            {/* Warning Icon (SVG) */}
            <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="relative z-10 filter drop-shadow-md group-hover:rotate-12 transition-transform duration-500"
            >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                <line x1="12" y1="9" x2="12" y2="13"></line>
                <line x1="12" y1="17" x2="12.01" y2="17"></line>
            </svg>

            {/* Outer Pulse Effect */}
            <div className="absolute inset-0 rounded-full border-4 border-red-500 animate-ping opacity-25"></div>
            <div className="absolute inset-0 rounded-full border-2 border-red-400 animate-pulse opacity-40"></div>
        </motion.button>
    );
};

export default EmergencyButton;
