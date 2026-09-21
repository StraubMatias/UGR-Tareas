import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "UGR - Tareas",
  description: "Control de tareas, parciales y notas entre amigos",
};

// La sincronización con UGR encadena varios pedidos HTTP a Moodle (login,
// cursos, tareas, detalles). Vercel usa este límite para la función que
// ejecuta las Server Actions de esta ruta: 60s es el tope del plan Hobby.
export const maxDuration = 60;

export default function RootLayout({ children }) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
