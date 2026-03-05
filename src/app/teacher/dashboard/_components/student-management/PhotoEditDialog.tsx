
'use client';
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
  DialogDescription,
} from "@/components/ui/dialog";
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
} from "@/components/ui/alert-dialog";
import { Camera, Loader2, User as UserIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Student } from "@/lib/types";

const resizeAndCompressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = document.createElement("img");
      img.src = e.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const targetWidth = 300; const targetHeight = 400;
        canvas.width = targetWidth; canvas.height = targetHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas error"));
        const sourceAspectRatio = img.width / img.height;
        const targetAspectRatio = targetWidth / targetHeight;
        let sx, sy, sWidth, sHeight;
        if (sourceAspectRatio > targetAspectRatio) {
          sHeight = img.height; sWidth = sHeight * targetAspectRatio;
          sx = (img.width - sWidth) / 2; sy = 0;
        } else {
          sWidth = img.width; sHeight = sWidth / targetAspectRatio;
          sx = 0; sy = (img.height - sHeight) / 2;
        }
        ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
    };
  });
};

export function PhotoEditDialog({ student, onUpdatePhoto }: { student: Student, onUpdatePhoto: (id: string, url: string) => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => { if (!isOpen) { setFile(null); setPreview(null); } }, [isOpen]);
  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setPreview(url); return () => URL.revokeObjectURL(url);
    }
    setPreview(student.photoUrl || null);
  }, [file, student.photoUrl, isOpen]);

  const handleSave = async () => {
    if (!file) return;
    setIsProcessing(true);
    try {
      const resized = await resizeAndCompressImage(file);
      await onUpdatePhoto(student.id, resized);
      setIsOpen(false);
    } catch (err) { toast({ variant: "destructive", title: "이미지 처리 실패" }); }
    finally { setIsProcessing(false); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild><Button variant="ghost" size="icon"><Camera className="h-4 w-4" /></Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{student.name} 사진 관리</DialogTitle><DialogDescription>3:4 비율로 자동 압축 저장됩니다.</DialogDescription></DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="w-48 h-64 rounded-md border border-dashed flex items-center justify-center bg-muted overflow-hidden">
            {preview ? <img src={preview} alt="미리보기" className="w-full h-full object-cover" /> : <UserIcon className="w-12 h-12 text-muted-foreground" />}
          </div>
          <input type="file" accept="image/jpeg,image/jpg" ref={fileInputRef} onChange={e => setFile(e.target.files?.[0] || null)} className="hidden" />
          <Button variant="outline" onClick={() => fileInputRef.current?.click()}>사진 찾기</Button>
        </div>
        <DialogFooter className="sm:justify-between">
          <AlertDialog>
            <AlertDialogTrigger asChild><Button variant="destructive" disabled={!student.photoUrl || isProcessing}>삭제</Button></AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader><AlertDialogTitle>사진 삭제</AlertDialogTitle><AlertDialogDescription>영구 삭제됩니다.</AlertDialogDescription></AlertDialogHeader>
              <AlertDialogFooter><AlertDialogCancel>취소</AlertDialogCancel><AlertDialogAction onClick={() => onUpdatePhoto(student.id, "")}>삭제</AlertDialogAction></AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <div className="flex gap-2"><DialogClose asChild><Button variant="outline">취소</Button></DialogClose><Button onClick={handleSave} disabled={!file || isProcessing}>{isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}저장</Button></div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
