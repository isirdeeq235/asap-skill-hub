import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, GraduationCap, Users, Award } from "lucide-react";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import atapolyLogo from "@/assets/atapoly-logo.png";
import atapolyBackground from "@/assets/atapoly-background.jpg";
import atapolyBg2 from "@/assets/atapoly-bg-2.jpg";
import atapolyBg3 from "@/assets/atapoly-bg-3.jpg";
import atapolyBg4 from "@/assets/atapoly-bg-4.jpg";

const backgroundImages = [atapolyBackground, atapolyBg2, atapolyBg3, atapolyBg4];

const Index = () => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % backgroundImages.length);
    }, 5000); // Change image every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return <div className="min-h-screen bg-background">
      {/* Header with Logo */}
      <header className="bg-card border-b border-border py-3 px-4">
        <div className="container mx-auto max-w-6xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={atapolyLogo} alt="ATAP Logo" className="h-12 w-auto" />
            <div className="hidden sm:block">
              <h1 className="text-sm font-bold text-foreground leading-tight">ABUBAKAR TATARI ALI</h1>
              <p className="text-xs text-muted-foreground">POLYTECHNIC BAUCHI</p>
            </div>
          </div>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/student/auth">Student Portal</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin/auth">Admin</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Hero Section with Background Image Slideshow */}
      <section className="relative overflow-hidden py-24 px-4">
        {/* Background Images with Fade Transition */}
        {backgroundImages.map((image, index) => (
          <div
            key={index}
            className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-1000 ease-in-out"
            style={{
              backgroundImage: `url(${image})`,
              opacity: index === currentImageIndex ? 1 : 0,
            }}
          />
        ))}
        <div className="absolute inset-0 bg-primary/80" />
        
        <div className="container mx-auto max-w-6xl relative z-10">
          <div className="text-center text-primary-foreground">
            <div className="flex justify-center mb-6">
              <img src={atapolyLogo} alt="ATAP Logo" className="h-24 w-auto" />
            </div>
            <h1 className="mb-6 text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
              ATAP Skills Center
            </h1>
            <p className="mb-4 text-xl md:text-2xl font-light max-w-3xl mx-auto">
              Abubakar Tatari Ali Polytechnic Skill Acquisition Program
            </p>
            <p className="mb-12 text-lg max-w-2xl mx-auto opacity-90">
              Register for your mandatory skill acquisition program and unlock new opportunities for personal and professional growth.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="text-lg px-8 py-6 bg-white text-primary hover:bg-white/90">
                <Link to="/student/auth">Student Portal</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="text-lg px-8 py-6 bg-transparent border-white text-white hover:bg-white/10">
                <Link to="/admin/auth">Admin Login</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 text-foreground">
            Why Join Our Skills Program?
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="shadow-card hover:shadow-hover transition-shadow">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <div className="mb-4 p-3 bg-primary/10 rounded-full">
                    <GraduationCap className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Practical Skills</h3>
                  <p className="text-muted-foreground">
                    Learn industry-relevant skills that enhance your employability.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card hover:shadow-hover transition-shadow">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <div className="mb-4 p-3 bg-primary/10 rounded-full">
                    <BookOpen className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Expert Training</h3>
                  <p className="text-muted-foreground">
                    Professional instructors with real-world experience.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card hover:shadow-hover transition-shadow">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <div className="mb-4 p-3 bg-primary/10 rounded-full">
                    <Award className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Certification</h3>
                  <p className="text-muted-foreground">
                    Receive official certification upon completion.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card hover:shadow-hover transition-shadow">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <div className="mb-4 p-3 bg-primary/10 rounded-full">
                    <Users className="w-8 h-8 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">Networking</h3>
                  <p className="text-muted-foreground">
                    Connect with peers and industry professionals
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-foreground">
            Ready to Get Started?
          </h2>
          <p className="text-xl mb-8 text-muted-foreground">
            Register now and take the first step towards acquiring valuable skills
          </p>
          <Button asChild size="lg" className="text-lg px-8 py-6">
            <Link to="/student/auth">Register Now</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border">
        <div className="container mx-auto max-w-6xl text-center text-muted-foreground">
          <p>&copy; 2024 Abubakar Tatari Ali Polytechnic. All rights reserved.</p>
        </div>
      </footer>
    </div>;
};
export default Index;