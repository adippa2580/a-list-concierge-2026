'use client';

import { AListLogo } from './AListLogo';

export function Footer() {
  return (
    <footer className="border-t border-[#E5E4E2]/5 py-10 px-6 bg-[#060606]">
      <div className="max-w-md mx-auto space-y-8">

        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <AListLogo variant="full" size="md" />
          <p className="text-[7px] uppercase tracking-[0.4em] text-white/20 text-center">
            Luxury Nightlife Intelligence
          </p>
        </div>

        {/* Links */}
        <div className="grid grid-cols-3 gap-4 text-center">
          {[
            { heading: 'Company', links: ['About', 'Careers', 'Press'] },
            { heading: 'Support', links: ['Help', 'Safety', 'Contact'] },
            { heading: 'Legal', links: ['Terms', 'Privacy', 'Cookies'] },
          ].map(({ heading, links }) => (
            <div key={heading} className="space-y-3">
              <h4 className="text-[7px] font-bold uppercase tracking-[0.3em] text-white/30">{heading}</h4>
              <ul className="space-y-2">
                {links.map(link => (
                  <li key={link}>
                    <a
                      href="#"
                      className="text-[7px] uppercase tracking-[0.2em] text-white/20 hover:text-white/60 transition-colors"
                    >
                      {link}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-[#E5E4E2]/10 to-transparent" />

        {/* Copyright */}
        <p className="text-center text-[7px] uppercase tracking-[0.3em] text-white/15">
          © 2026 A-LIST. Built for the elite.
        </p>
      </div>
    </footer>
  );
}
