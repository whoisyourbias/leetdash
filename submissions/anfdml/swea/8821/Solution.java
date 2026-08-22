import java.util.ArrayList;
import java.util.Scanner;

class Solution
{
	public static void main(String args[]) throws Exception
	{
		
		Scanner sc = new Scanner(System.in);
		int T;
		T=sc.nextInt();
		
		for(int test_case = 1; test_case <= T; test_case++)
		{
			String N = sc.next();
			
			int arr[] = new int[10];
			for (int i = 0; i < N.length(); i++) {
				int a = N.charAt(i)-'0';
				if(arr[a]==0) {
					arr[a]=1;
				}else {
					arr[a]=0;
				}
			}
			
			int ans =0;
			for (int i = 0; i < arr.length; i++) {
				if(arr[i]==1) {
					ans++;
				}
			}
			System.out.println("#"+test_case+" "+ans);
		}
	}
}
