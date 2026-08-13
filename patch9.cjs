const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

if (!code.includes("import { motion }")) {
  code = code.replace("import React, { useState, useEffect } from 'react';", "import React, { useState, useEffect } from 'react';\nimport { motion, AnimatePresence } from 'motion/react';");
}

code = code.replace(`            {/* Notification drop indicator */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-50 rounded-xl transition-all border border-slate-100 relative"
                title="Antrean Tugas"
              >
                <Bell className="w-4 h-4" />
                {notifications.some(n => !n.read) && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
                )}
              </button>`, `            {/* Notification drop indicator */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifDropdown(!showNotifDropdown)}
                className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-50 rounded-xl transition-all border border-slate-100 relative"
                title="Antrean Tugas"
              >
                <Bell className="w-4 h-4" />
                <AnimatePresence>
                  {notifications.some(n => !n.read) && (
                    <motion.div 
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: [1, 1.5, 1], opacity: 1 }}
                      transition={{ 
                        duration: 0.5, 
                        repeat: Infinity,
                        repeatType: "reverse",
                        repeatDelay: 1.5
                      }}
                      className="absolute top-1 right-1"
                    >
                      <span className="flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </button>`);

fs.writeFileSync('src/App.tsx', code);
