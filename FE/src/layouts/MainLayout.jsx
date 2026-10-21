import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
export default function MainLayout({ children }) {
  return (
    <>
      <Navbar />
      <main className="min-h-[60vh]">{children}</main>
      <Footer />
    </>
  );
}
