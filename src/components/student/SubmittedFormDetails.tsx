import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckCircle, Clock, XCircle, Eye, Calendar, GraduationCap, Wrench, FileText, User } from "lucide-react";

interface SkillForm {
  skill_choice: string;
  submitted_at: string;
  level: string;
  reason: string;
  additional_info: string | null;
  access_blocked: boolean;
  photo_url: string | null;
}

interface Profile {
  full_name: string;
  matric_number: string;
  department: string;
  application_status: string;
}

interface SubmittedFormDetailsProps {
  skillForm: SkillForm;
  profile: Profile;
}

const SubmittedFormDetails = ({ skillForm, profile }: SubmittedFormDetailsProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const getStatusBadge = () => {
    switch (profile.application_status) {
      case "form_verified":
        return (
          <Badge variant="default" className="bg-success flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> Verified
          </Badge>
        );
      case "form_rejected":
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <XCircle className="w-3 h-3" /> Rejected
          </Badge>
        );
      case "id_generated":
        return (
          <Badge variant="default" className="bg-primary flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> ID Generated
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Clock className="w-3 h-3" /> Pending Review
          </Badge>
        );
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-border">
              <AvatarImage src={skillForm.photo_url || undefined} alt={profile.full_name} />
              <AvatarFallback className="bg-primary/10 text-primary text-lg">
                {profile.full_name.split(" ").map(n => n[0]).join("").slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-lg">{profile.full_name}</CardTitle>
              <CardDescription>{profile.matric_number} • {profile.department}</CardDescription>
            </div>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Summary */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="flex items-center gap-2 text-sm">
            <GraduationCap className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Level:</span>
            <span className="font-medium">{skillForm.level}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Wrench className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Skill:</span>
            <span className="font-medium">{skillForm.skill_choice}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">Submitted:</span>
            <span className="font-medium">{new Date(skillForm.submitted_at).toLocaleDateString()}</span>
          </div>
        </div>

        {/* View Full Details Button */}
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full">
              <Eye className="w-4 h-4 mr-2" />
              View Full Submission Details
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Skill Acquisition Form Submission
              </DialogTitle>
              <DialogDescription>
                Your submitted registration details
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Photo and Basic Info */}
              <div className="flex flex-col sm:flex-row items-center gap-6 p-4 bg-muted/50 rounded-lg">
                {skillForm.photo_url && (
                  <img
                    src={skillForm.photo_url}
                    alt="Passport photograph"
                    className="w-32 h-32 object-cover rounded-lg border-2 border-border shadow-sm"
                  />
                )}
                <div className="space-y-2 text-center sm:text-left">
                  <h3 className="text-xl font-semibold">{profile.full_name}</h3>
                  <p className="text-muted-foreground">{profile.matric_number}</p>
                  <p className="text-muted-foreground">{profile.department}</p>
                  <div className="pt-2">{getStatusBadge()}</div>
                </div>
              </div>

              {/* Form Details */}
              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <GraduationCap className="w-4 h-4" /> Level
                    </label>
                    <p className="font-medium text-lg">{skillForm.level}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Wrench className="w-4 h-4" /> Preferred Skill
                    </label>
                    <p className="font-medium text-lg">{skillForm.skill_choice}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-muted-foreground">
                    Reason for Choosing This Skill
                  </label>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-foreground whitespace-pre-wrap">{skillForm.reason}</p>
                  </div>
                </div>

                {skillForm.additional_info && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-muted-foreground">
                      Additional Information
                    </label>
                    <div className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-foreground whitespace-pre-wrap">{skillForm.additional_info}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  Submitted on {new Date(skillForm.submitted_at).toLocaleDateString()} at{" "}
                  {new Date(skillForm.submitted_at).toLocaleTimeString()}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export default SubmittedFormDetails;
