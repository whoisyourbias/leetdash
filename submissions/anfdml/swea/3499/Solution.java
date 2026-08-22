import java.util.Iterator;
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
			int N =sc.nextInt();
			String[] str = new String[N];
			System.out.print("#"+test_case);
			for (int i = 0; i < str.length; i++) {
				str[i] = sc.next();
			}
			if(N%2==0) {
				for (int i = 0; i < N/2; i++) {
					System.out.print(" "+str[i]+" "+str[N/2 +i]);
				}
			}else {
				for (int i = 0; i < N/2; i++) {
					System.out.print(" "+str[i]+" "+str[N/2 +i +1]);
					
				}
				System.out.print(" "+ str[N/2]);
			}
			System.out.println();
			
		}
		
	}
}