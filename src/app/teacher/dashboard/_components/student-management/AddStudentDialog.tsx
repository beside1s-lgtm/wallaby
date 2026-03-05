
'use client';
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { StudentToAdd } from "@/lib/types";

export function AddStudentDialog({ onAddStudent, school }: { onAddStudent: (data: StudentToAdd) => Promise<void>, school: string }) {
  const [form, setForm] = useState<StudentToAdd>({ school, grade: "", classNum: "", studentNum: "", name: "", gender: "남" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!form.grade || !form.classNum || !form.studentNum || !form.name) {
      toast({ variant: "destructive", title: "입력 부족", description: "모든 정보를 입력해주세요." });
      return;
    }
    setIsSubmitting(true);
    await onAddStudent(form);
    setForm({ school, grade: "", classNum: "", studentNum: "", name: "", gender: "남" });
    setIsSubmitting(false);
    document.getElementById("add-student-dialog-close")?.click();
  };

  return (
    <Dialog>
      <DialogTrigger asChild><Button><UserPlus className="mr-2 h-4 w-4" /> 개별 등록</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>학생 개별 등록</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">학년</Label><Input value={form.grade} onChange={e => setForm({...form, grade: e.target.value})} className="col-span-3" /></div>
          <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">반</Label><Input value={form.classNum} onChange={e => setForm({...form, classNum: e.target.value})} className="col-span-3" /></div>
          <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">번호</Label><Input value={form.studentNum} onChange={e => setForm({...form, studentNum: e.target.value})} className="col-span-3" /></div>
          <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">이름</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="col-span-3" /></div>
          <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">성별</Label>
            <Select onValueChange={v => setForm({...form, gender: v as "남" | "여"})} value={form.gender}>
              <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="남">남</SelectItem><SelectItem value="여">여</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button id="add-student-dialog-close" variant="outline">취소</Button></DialogClose>
          <Button onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}등록</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
