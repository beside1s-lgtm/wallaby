'use client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

export default function TheoryExamManagement() {
    return (
        <Card className="bg-transparent shadow-none border-none">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl font-bold">
                    <BookOpen className="h-6 w-6 text-primary" />
                    이론 평가 관리
                </CardTitle>
                <CardDescription>
                    체육 교과 지식 및 이론 시험 성적을 등록하고 관리하는 공간입니다.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-xl bg-muted/30">
                    <div className="bg-background p-4 rounded-full shadow-sm mb-4">
                        <BookOpen className="h-10 w-10 text-muted-foreground opacity-50" />
                    </div>
                    <h3 className="text-lg font-semibold mb-1">기능 개발 중</h3>
                    <p className="text-sm text-muted-foreground text-center max-w-xs">
                        이론 평가 등록 및 성적 관리 기능이 곧 업데이트될 예정입니다. 조금만 기다려 주세요!
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}
