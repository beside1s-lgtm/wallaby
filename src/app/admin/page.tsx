'use client';
import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import {
  getSchools as getSchoolsFromDb,
  deleteSchoolAndData,
  updateSchoolPassword,
} from '@/lib/store';
import { School } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Settings } from 'lucide-react';
import { signIn } from '@/lib/firebase';
import Link from 'next/link';

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleLogin = async () => {
    setIsVerifying(true);
    setError('');
    // Simple password check
    if (password === 'admin') {
      try {
        await signIn(); // Ensure we are authenticated with Firebase
        setIsAdmin(true);
      } catch (e) {
        setError('Firebase 인증에 실패했습니다.');
      }
    } else {
      setError('비밀번호가 올바르지 않습니다.');
    }
    setIsVerifying(false);
  };

  if (isAdmin) {
    return <AdminDashboard />;
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
       <div className="flex items-center gap-4 mb-8 text-4xl font-bold text-primary">
        <Settings className="w-12 h-12" />
        <h1 className="font-headline">관리자 페이지</h1>
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>관리자 로그인</CardTitle>
          <CardDescription>관리자 비밀번호를 입력해주세요.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">비밀번호</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              placeholder="비밀번호 입력"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={handleLogin} disabled={isVerifying} className="w-full">
            {isVerifying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            로그인
          </Button>
          <Button variant="link" asChild className="w-full">
            <Link href="/">메인으로 돌아가기</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

function AdminDashboard() {
  const [schools, setSchools] = useState<School[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchSchools = async () => {
    setIsLoading(true);
    try {
      const schoolList = await getSchoolsFromDb();
      setSchools(schoolList);
    } catch (e) {
      toast({
        variant: 'destructive',
        title: '오류 발생',
        description: '학교 목록을 불러오는 데 실패했습니다.',
      });
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchSchools();
  }, []);

  const handleDeleteSchool = async (schoolName: string) => {
    try {
      await deleteSchoolAndData(schoolName);
      toast({
        title: '삭제 완료',
        description: `${schoolName}의 모든 데이터가 삭제되었습니다.`,
      });
      fetchSchools();
    } catch (e) {
      toast({
        variant: 'destructive',
        title: '삭제 실패',
        description: '학교 데이터 삭제 중 오류가 발생했습니다.',
      });
    }
  };

  const handleUpdatePassword = async (schoolName: string, newPass: string) => {
    try {
      await updateSchoolPassword(schoolName, newPass);
      toast({
        title: '비밀번호 변경 완료',
        description: `${schoolName}의 비밀번호가 변경되었습니다.`,
      });
      fetchSchools(); // Re-fetch to show updated data if needed
    } catch (e) {
      toast({
        variant: 'destructive',
        title: '변경 실패',
        description: '비밀번호 변경 중 오류가 발생했습니다.',
      });
    }
  };

  return (
     <div className="container mx-auto p-4 md:p-6 lg:p-8">
        <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold">전체 학교 관리</h1>
             <Button variant="outline" asChild>
                <Link href="/">메인으로 돌아가기</Link>
            </Button>
        </div>
        
      <Card>
        <CardHeader>
          <CardTitle>등록된 학교 목록</CardTitle>
          <CardDescription>
            전체 학교 목록을 확인하고 관리합니다. 학교 삭제는 되돌릴 수 없으니
            주의해주세요.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center h-48">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>학교 이름</TableHead>
                  <TableHead>등록일</TableHead>
                  <TableHead className="text-right">관리</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schools.length > 0 ? (
                  schools.map((school) => (
                    <TableRow key={school.id}>
                      <TableCell className="font-medium">{school.name}</TableCell>
                      <TableCell>
                        {school.createdAt?.toDate().toLocaleDateString() || 'N/A'}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <ChangePasswordDialog
                          schoolName={school.name}
                          onUpdatePassword={handleUpdatePassword}
                        />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              삭제
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                정말로 {school.name}을(를) 삭제하시겠습니까?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                이 작업은 되돌릴 수 없습니다. 학교, 학생, 기록
                                등 모든 관련 데이터가 영구적으로 삭제됩니다.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>취소</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteSchool(school.name)}
                              >
                                삭제
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={3} className="h-24 text-center">
                      등록된 학교가 없습니다.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ChangePasswordDialog({ schoolName, onUpdatePassword }: { schoolName: string, onUpdatePassword: (schoolName: string, newPass: string) => void }) {
    const [newPassword, setNewPassword] = useState('');
    const [isUpdating, setIsUpdating] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    const handleConfirm = async () => {
        if (newPassword.length < 4) {
            alert('비밀번호는 4자 이상이어야 합니다.');
            return;
        }
        setIsUpdating(true);
        await onUpdatePassword(schoolName, newPassword);
        setIsUpdating(false);
        setIsOpen(false);
        setNewPassword('');
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">비밀번호 변경</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{schoolName} 비밀번호 변경</DialogTitle>
                    <DialogDescription>새로운 비밀번호를 입력해주세요. 변경 즉시 적용됩니다.</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Label htmlFor="new-password">새 비밀번호 (4자 이상)</Label>
                    <Input id="new-password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button variant="outline">취소</Button>
                    </DialogClose>
                    <Button onClick={handleConfirm} disabled={isUpdating}>
                         {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        변경
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
