import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';

/** Transisi halaman mulus: fade-in + slide-up setiap pindah menu */
export default function PageTransition({ children }) {
  const { pathname } = useLocation();
  return (
    <motion.main
      key={pathname}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
      className="min-w-0 flex-1"
    >
      {children}
    </motion.main>
  );
}
