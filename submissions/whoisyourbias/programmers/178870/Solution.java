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
            if (lst.size() != 0 && lst.get(0).length <= r-l) {
                l=l+1;
                r=l+1;
                if (l >= sequence.length)
                    break;
                sum=sequence[l];
                continue;
            }
            
            if (sum == k) {
                if (lst.size() == 0) {
                    lst.add(new KV(r-l, l, r-1));
                } else {
                    if (lst.get(0).length > r-l) {
                        lst.clear();
                        lst.addFirst(new KV(r-l, l, r-1));
                    } else if (lst.get(0).length == r-l) {
                    } else {}
                }
                        
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
        int[] answer = new int[2];
        answer[0] = lst.get(0).l;
        answer[1] = lst.get(0).r;
        return answer;
    }
}