
'use client';
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Pencil, Loader2 } from "lucide-react";
import type { Student, StudentToUpdate } from "@/lib/types";

export function EditStudentDialog({ student, onUpdateStudent }: { student: Student, onUpdateStudent: (data: StudentToUpdate) => Promise<void> }) {
  const [form, setForm] = useState<StudentToUpdate>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (student && isOpen) setForm({ grade: student.grade, classNum: student.classNum, studentNum: student.studentNum, name: student.name, gender: student.gender });
  }, [student, isOpen]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    await onUpdateStudent(form);
    setIsSubmitting(false);
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <Button variant="outline" onClick={() => setIsOpen(true)}><Pencil className="mr-2 h-4 w-4" /> 정보 수정</Button>
      <DialogContent>
        <DialogHeader><DialogTitle>학생 정보 수정</DialogTitle></DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">학년</Label><Input value={form.grade || ''} onChange={e => setForm({...form, grade: e.target.value})} className="col-span-3" /></div>
          <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">반</Label><Input value={form.classNum || ''} onChange={e => setForm({...form, classNum: e.target.value})} className="col-span-3" /></div>
          <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">번호</Label><Input value={form.studentNum || ''} onChange={e => setForm({...form, studentNum: e.target.value})} className="col-span-3" /></div>
          <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">이름</Label><Input value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} className="col-span-3" /></div>
          <div className="grid grid-cols-4 items-center gap-4"><Label className="text-right">성별</Label>
            <Select onValueChange={v => setForm({...form, gender: v as "남" | "여"})} value={form.gender}>
              <SelectTrigger className="col-span-3"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="남">남</SelectItem><SelectItem value="여">여</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline">취소</Button></DialogClose>
          <Button onClick={handleSubmit} disabled={isSubmitting}>{isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}저장</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
