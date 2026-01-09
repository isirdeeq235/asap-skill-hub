import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, History, User, CreditCard, FileText, IdCard, Clock, ChevronRight, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

interface UserHistory {
  user_id: string;
  full_name: string;
  email: string;
  matric_number: string;
  department: string;
  created_at: string;
  application_status: string;
  payments: Array<{
    id: string;
    reference: string;
    amount: number;
    status: string;
    created_at: string;
  }>;
  skillForm: {
    id: string;
    skill_choice: string;
    level: string;
    reason: string;
    additional_info: string | null;
    photo_url: string | null;
    submitted_at: string;
    verified_at: string | null;
    verification_notes: string | null;
  } | null;
  idCard: {
    id: string;
    card_url: string;
    generated_at: string;
    generated_by: string;
  } | null;
  editRequests: Array<{
    id: string;
    reason: string | null;
    status: string;
    requested_at: string;
    reviewed_at: string | null;
  }>;
}

interface UserHistoryViewerProps {
  userId: string;
  userName: string;
  open: boolean;
  onClose: () => void;
}

const UserHistoryViewer = ({ userId, userName, open, onClose }: UserHistoryViewerProps) => {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<UserHistory | null>(null);

  useEffect(() => {
    if (open && userId) {
      fetchUserHistory();
    }
  }, [open, userId]);

  const fetchUserHistory = async () => {
    setLoading(true);
    try {
      // Fetch profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      // Fetch payments
      const { data: payments } = await supabase
        .from('payments')
        .select('*')
        .eq('student_id', userId)
        .order('created_at', { ascending: false });

      // Fetch skill form
      const { data: skillForm } = await supabase
        .from('skill_forms')
        .select('*')
        .eq('student_id', userId)
        .maybeSingle();

      // Fetch ID card
      const { data: idCard } = await supabase
        .from('id_cards')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      // Fetch edit requests
      const { data: editRequests } = await supabase
        .from('edit_requests')
        .select('*')
        .eq('student_id', userId)
        .order('requested_at', { ascending: false });

      if (profile) {
        setHistory({
          user_id: profile.user_id,
          full_name: profile.full_name,
          email: profile.email,
          matric_number: profile.matric_number,
          department: profile.department,
          created_at: profile.created_at || '',
          application_status: profile.application_status,
          payments: payments || [],
          skillForm: skillForm || null,
          idCard: idCard || null,
          editRequests: editRequests || [],
        });
      }
    } catch (error) {
      console.error('Error fetching user history:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      success: 'bg-green-500/10 text-green-500',
      pending: 'bg-yellow-500/10 text-yellow-500',
      failed: 'bg-red-500/10 text-red-500',
      approved: 'bg-green-500/10 text-green-500',
      rejected: 'bg-red-500/10 text-red-500',
    };
    return colors[status] || 'bg-muted text-muted-foreground';
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Complete History: {userName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : history ? (
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6">
              {/* User Info */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <User className="h-4 w-4" />
                    Profile Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Email:</span>
                      <p className="font-medium">{history.email}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Matric Number:</span>
                      <p className="font-medium">{history.matric_number}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Department:</span>
                      <p className="font-medium">{history.department}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Registered:</span>
                      <p className="font-medium">
                        {history.created_at ? format(new Date(history.created_at), 'PPP') : 'N/A'}
                      </p>
                    </div>
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Application Status:</span>
                      <Badge className="ml-2">{history.application_status.replace('_', ' ')}</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Payments */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <CreditCard className="h-4 w-4" />
                    Payment History ({history.payments.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {history.payments.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No payments found</p>
                  ) : (
                    <div className="space-y-3">
                      {history.payments.map((payment) => (
                        <div key={payment.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                          <div>
                            <p className="font-medium text-sm">₦{payment.amount.toLocaleString()}</p>
                            <p className="text-xs text-muted-foreground">Ref: {payment.reference}</p>
                          </div>
                          <div className="text-right">
                            <Badge className={getStatusColor(payment.status)}>{payment.status}</Badge>
                            <p className="text-xs text-muted-foreground mt-1">
                              {payment.created_at ? format(new Date(payment.created_at), 'PPp') : 'N/A'}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Skill Form */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-4 w-4" />
                    Skill Form
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!history.skillForm ? (
                    <p className="text-muted-foreground text-sm">No skill form submitted</p>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Skill Choice:</span>
                          <p className="font-medium">{history.skillForm.skill_choice}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Level:</span>
                          <p className="font-medium">{history.skillForm.level}</p>
                        </div>
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Reason:</span>
                          <p className="font-medium">{history.skillForm.reason}</p>
                        </div>
                        {history.skillForm.additional_info && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Additional Info:</span>
                            <p className="font-medium">{history.skillForm.additional_info}</p>
                          </div>
                        )}
                        <div>
                          <span className="text-muted-foreground">Submitted:</span>
                          <p className="font-medium">
                            {history.skillForm.submitted_at 
                              ? format(new Date(history.skillForm.submitted_at), 'PPp') 
                              : 'N/A'}
                          </p>
                        </div>
                        {history.skillForm.verified_at && (
                          <div>
                            <span className="text-muted-foreground">Verified:</span>
                            <p className="font-medium">
                              {format(new Date(history.skillForm.verified_at), 'PPp')}
                            </p>
                          </div>
                        )}
                        {history.skillForm.verification_notes && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Verification Notes:</span>
                            <p className="font-medium">{history.skillForm.verification_notes}</p>
                          </div>
                        )}
                      </div>
                      {history.skillForm.photo_url && (
                        <div>
                          <span className="text-muted-foreground text-sm">Passport Photo:</span>
                          <img 
                            src={history.skillForm.photo_url} 
                            alt="Passport" 
                            className="mt-2 w-24 h-24 object-cover rounded-lg border"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* ID Card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <IdCard className="h-4 w-4" />
                    ID Card
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!history.idCard ? (
                    <p className="text-muted-foreground text-sm">No ID card generated</p>
                  ) : (
                    <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                      <div>
                        <p className="font-medium text-sm">ID Card Generated</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(history.idCard.generated_at), 'PPp')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          By: {history.idCard.generated_by}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(history.idCard!.card_url, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Edit Requests */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Clock className="h-4 w-4" />
                    Edit Requests ({history.editRequests.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {history.editRequests.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No edit requests</p>
                  ) : (
                    <div className="space-y-3">
                      {history.editRequests.map((request) => (
                        <div key={request.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                          <div>
                            <p className="font-medium text-sm">{request.reason || 'No reason provided'}</p>
                            <p className="text-xs text-muted-foreground">
                              Requested: {format(new Date(request.requested_at), 'PPp')}
                            </p>
                          </div>
                          <Badge className={getStatusColor(request.status)}>{request.status}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        ) : (
          <p className="text-muted-foreground text-center py-8">User not found</p>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default UserHistoryViewer;
