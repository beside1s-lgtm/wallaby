
'use client';
import { useState, useRef } from "react";
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
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ImageIcon, FileUp, Loader2, Save, User as UserIcon, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { updateStudent } from "@/lib/store";
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

export function BatchPhotoUploadDialog({ students, onComplete, school }: { students: Student[], onComplete: () => void, school: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pendingPhotos, setPendingPhotos] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFilesSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return;
    setIsProcessing(true);
    const files = Array.from(e.target.files);
    const newPending = { ...pendingPhotos };
    let matchCount = 0;
    for (const file of files) {
      if (!file.type.startsWith('image/jpeg')) continue;
      const fileName = file.name.replace(/\.[^/.]+$/, "");
      const matchingStudent = students.find(s => fileName.includes(s.name));
      if (matchingStudent) {
        try {
          newPending[matchingStudent.id] = await resizeAndCompressImage(file);
          matchCount++;
        } catch (err) { console.error(err); }
      }
    }
    setPendingPhotos(newPending);
    setIsProcessing(false);
    toast({ title: "사진 배정 완료", description: `${matchCount}개의 사진이 매칭되었습니다.` });
    e.target.value = "";
  };

  const handleSaveAll = async () => {
    setIsProcessing(true);
    try {
      await Promise.all(Object.entries(pendingPhotos).map(([id, url]) => updateStudent(school, id, { photoUrl: url })));
      onComplete(); setIsOpen(false); setPendingPhotos({});
      toast({ title: "일괄 저장 완료" });
    } catch (err) { toast({ variant: "destructive", title: "저장 실패" }); }
    finally { setIsProcessing(false); }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild><Button variant="outline"><ImageIcon className="mr-2 h-4 w-4" /> 사진 일괄 등록</Button></DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader><DialogTitle>학급 사진 일괄 등록</DialogTitle><DialogDescription>여러 사진을 선택하면 이름 기반으로 자동 배정됩니다.</DialogDescription></DialogHeader>
        <div className="flex justify-between items-center py-2 border-b">
          <div className="flex gap-2">
            <input type="file" multiple accept="image/jpeg,image/jpg" className="hidden" ref={fileInputRef} onChange={handleFilesSelect} />
            <Button onClick={() => fileInputRef.current?.click()} disabled={isProcessing}><FileUp className="mr-2 h-4 w-4" /> 파일 다중 선택</Button>
            <Button variant="ghost" onClick={() => setPendingPhotos({})} disabled={!Object.keys(pendingPhotos).length}>초기화</Button>
          </div>
          <div className="text-sm font-medium text-primary">배정됨: {Object.keys(pendingPhotos).length}개</div>
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {students.map(s => (
              <Card key={s.id} className={cn(pendingPhotos[s.id] && "ring-2 ring-primary")}>
                <CardContent className="p-2 flex flex-col items-center gap-2">
                  <div className="w-full aspect-[3/4] bg-muted rounded-md flex items-center justify-center overflow-hidden border">
                    {pendingPhotos[s.id] ? <img src={pendingPhotos[s.id]} className="w-full h-full object-cover" /> : s.photoUrl ? <img src={s.photoUrl} className="w-full h-full object-cover opacity-50" /> : <UserIcon className="w-12 h-12 text-muted-foreground/30" />}
                    {pendingPhotos[s.id] && <div className="absolute top-1 right-1 bg-primary text-white rounded-full p-0.5"><CheckCircle2 className="w-4 h-4" /></div>}
                  </div>
                  <div className="text-center"><p className="font-bold text-sm">{s.name}</p><p className="text-xs text-muted-foreground">{s.studentNum}번</p></div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        <DialogFooter className="border-t pt-4">
          <DialogClose asChild><Button variant="outline">취소</Button></DialogClose>
          <Button onClick={handleSaveAll} disabled={isProcessing || !Object.keys(pendingPhotos).length}>{isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}모두 저장</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
