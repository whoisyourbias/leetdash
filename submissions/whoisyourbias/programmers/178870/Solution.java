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
        int l = 0;
        int r = l + 1;
        int sum = sequence[l];
        while (l <= r) {
            if (sum == k) {
                lst.add(new KV(r-l, l, r-1));
                l=l+1;
                r=l+1;
                if (l == sequence.length)
                    break;
                sum=sequence[l];
            } else if (sum < k) {
                if (r == sequence.length)
                    break;
                sum += sequence[r];
                r += 1;
            } else {
                if (l == sequence.length)
                    break;
                
                sum -= sequence[l];
                l++;
            }
        }
        
        Collections.sort(lst, (a,b) -> {
            if (a.length == b.length)
                return a.l - b.l;
            return a.length - b.length;
        });
        int[] answer = new int[2];
        answer[0] = lst.get(0).l;
        answer[1] = lst.get(0).r;
        return answer;
    }
}