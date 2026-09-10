import java.util.*;
class Solution {
    class KV {
        int length;
        int l;
        int r;
        KV(int length, int l, int r) {this.length = length; this.l=l;this.r=r;}
    }
    
    public int[] solution(int[] sequence, int k) {
        ArrayList<KV> lst = new ArrayList<>();
        int r = sequence.length - 1;
        int sum = 0;
        int minLength = Integer.MAX_VALUE;
        while (r >= 0) {
            sum += sequence[r];
            int l =r - 1;
            while (
                (r-l <= minLength) &&
                (l >= 0) &&
                (sequence[l] + sum < k) 
            ) {
                sum += sequence[l];
                l--;
            }
            
            if (sum == k) {
                lst.add(new KV(0 ,r,r));
                r--;
                sum =0;
                minLength = Math.min(minLength, 0);
                continue;
            }
            
            if (l >= 0 &&
                sequence[l] + sum == k) {
                // add answer set;
                lst.add(new KV(r-l,l,r));
                minLength = Math.min(minLength, r-l);
                r--;
                sum =0;
                continue;
            }
            sum = 0;
            r--;
        }
        
        int[] answer = new int[2];
        
        Collections.sort(lst, (a, b) -> {
            if (a.length == b.length)
                return a.l - b.l;
            return a.length - b.length;
        });
        answer[0] = lst.get(0).l;
        answer[1] = lst.get(0).r;
        return answer;
    }
}