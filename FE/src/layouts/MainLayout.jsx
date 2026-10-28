import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import FloatingChatWidget from "../components/FloatingChatWidget";

export default function MainLayout({ children }) {
  return (
    <>
      <Navbar />
      <main className="min-h-[60vh]">{children}</main>
      <Footer />
      {/* Widget chat nổi toàn trang cho cả Traveler và Local */}
      <FloatingChatWidget />
    </>
  );
}
