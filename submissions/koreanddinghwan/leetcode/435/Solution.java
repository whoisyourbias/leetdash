import java.util.*;

class Solution {
    public int eraseOverlapIntervals(int[][] intervals) {
        int c = 1;
        Arrays.sort(intervals, (a, b) -> Integer.compare(a[1], b[1]));
        
        for (int[] is: intervals)
            System.out.println(Arrays.toString(is));

        int end = intervals[0][1];

        for (int i = 1; i < intervals.length; i++) {
            
            // 안 겹치는 범위만 카운팅
            if (intervals[i][0] >= end) {
                c++;
                end = intervals[i][1];
            }
        }

        return intervals.length - c;
    }
}