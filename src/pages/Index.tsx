import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen, GraduationCap, Users, Award } from "lucide-react";
import { Link } from "react-router-dom";
const Index = () => {
  return <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-hero py-20 px-4 text-warning-foreground bg-yellow-600">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center text-primary-foreground">
            <h1 className="mb-6 text-5xl md:text-6xl font-bold tracking-tight">
              ATAP Skills Center
            </h1>
            <p className="mb-8 text-xl md:text-2xl font-light max-w-3xl mx-auto">
              Abubakar Tatari Ali Polytechnic Skill Acquisition Program
            </p>
            <p className="mb-12 text-lg max-w-2xl mx-auto opacity-90">
              Register for your mandatory skill acquisition program and unlock new opportunities for personal and professional growth.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" variant="secondary" className="text-lg px-8 py-6">
                <Link to="/student/auth">Student Portal</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="text-lg px-8 py-6 bg-background/10 hover:bg-background/20 text-primary-foreground border-primary-foreground/20">
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
                    Learn industry-relevant skills that enhance your employability
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
                    Professional instructors with real-world experience
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
                    Receive official certification upon completion
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