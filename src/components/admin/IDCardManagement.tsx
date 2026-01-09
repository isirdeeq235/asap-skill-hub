import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Search, IdCard, ExternalLink, RefreshCw, Download, Eye, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface IDCardWithUser {
  id: string;
  user_id: string;
  card_url: string;
  generated_at: string;
  generated_by: string;
  user_name: string;
  user_email: string;
  matric_number: string;
}

const IDCardManagement = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [idCards, setIdCards] = useState<IDCardWithUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [regenerateDialog, setRegenerateDialog] = useState<IDCardWithUser | null>(null);
  const [justification, setJustification] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    fetchIDCards();
  }, []);

  const fetchIDCards = async () => {
    try {
      setLoading(true);

      const { data: cards, error: cardsError } = await supabase
        .from('id_cards')
        .select('*')
        .order('generated_at', { ascending: false });

      if (cardsError) throw cardsError;

      // Fetch profiles for all card holders
      const userIds = cards?.map(c => c.user_id) || [];
      
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, matric_number')
        .in('user_id', userIds);

      const cardsWithUsers: IDCardWithUser[] = (cards || []).map(card => {
        const profile = profiles?.find(p => p.user_id === card.user_id);
        return {
          id: card.id,
          user_id: card.user_id,
          card_url: card.card_url,
          generated_at: card.generated_at,
          generated_by: card.generated_by,
          user_name: profile?.full_name || 'Unknown',
          user_email: profile?.email || 'Unknown',
          matric_number: profile?.matric_number || 'Unknown',
        };
      });

      setIdCards(cardsWithUsers);
    } catch (error) {
      console.error('Error fetching ID cards:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch ID cards',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const logAction = async (actionType: string, targetId: string, metadata: Record<string, unknown>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      
      await supabase.from('action_logs').insert([{
        actor_id: user.id,
        action_type: actionType,
        target_table: 'id_cards',
        target_id: targetId,
        metadata: metadata as any,
      }]);
    } catch (error) {
      console.error('Error logging action:', error);
    }
  };

  const handleRegenerateID = async () => {
    if (!regenerateDialog || !justification.trim()) {
      toast({
        title: 'Justification Required',
        description: 'Please provide a reason for regenerating this ID card',
        variant: 'destructive',
      });
      return;
    }

    setProcessing(true);
    try {
      // Delete the existing ID card record
      const { error: deleteError } = await supabase
        .from('id_cards')
        .delete()
        .eq('id', regenerateDialog.id);

      if (deleteError) throw deleteError;

      // Update user status to form_verified so they can regenerate
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ application_status: 'form_verified' as any })
        .eq('user_id', regenerateDialog.user_id);

      if (updateError) throw updateError;

      await logAction('regenerate_id_card', regenerateDialog.id, {
        user_id: regenerateDialog.user_id,
        user_email: regenerateDialog.user_email,
        justification: justification,
      });

      toast({
        title: 'ID Card Reset',
        description: `${regenerateDialog.user_name} can now generate a new ID card`,
      });

      setRegenerateDialog(null);
      setJustification('');
      fetchIDCards();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to reset ID card',
        variant: 'destructive',
      });
    } finally {
      setProcessing(false);
    }
  };

  const filteredCards = idCards.filter(card =>
    card.user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    card.user_email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    card.matric_number.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IdCard className="h-5 w-5" />
            ID Card Management
          </CardTitle>
          <CardDescription>View and manage all generated student ID cards ({idCards.length} total)</CardDescription>
          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search by name, email, or matric number..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Matric Number</TableHead>
                  <TableHead>Generated</TableHead>
                  <TableHead>Generated By</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCards.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No ID cards found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCards.map((card) => (
                    <TableRow key={card.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{card.user_name}</p>
                          <p className="text-sm text-muted-foreground">{card.user_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{card.matric_number}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(card.generated_at), 'PPp')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{card.generated_by}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => window.open(card.card_url, '_blank')}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setRegenerateDialog(card)}
                          >
                            <RefreshCw className="h-4 w-4 mr-1" />
                            Reset
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Regenerate Confirmation Dialog */}
      <Dialog open={!!regenerateDialog} onOpenChange={() => {
        setRegenerateDialog(null);
        setJustification('');
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Reset ID Card
            </DialogTitle>
            <DialogDescription>
              This will delete {regenerateDialog?.user_name}'s current ID card and allow them to generate a new one.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-3 bg-destructive/10 rounded-lg text-sm">
              <p><strong>User:</strong> {regenerateDialog?.user_name}</p>
              <p><strong>Matric:</strong> {regenerateDialog?.matric_number}</p>
              <p><strong>Current ID Generated:</strong> {regenerateDialog?.generated_at && format(new Date(regenerateDialog.generated_at), 'PPp')}</p>
            </div>
            <div className="space-y-2">
              <Label className="text-destructive">Justification (required)</Label>
              <Textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Explain why this ID card needs to be regenerated..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setRegenerateDialog(null);
              setJustification('');
            }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRegenerateID}
              disabled={processing || !justification.trim()}
            >
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Reset ID Card
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default IDCardManagement;
